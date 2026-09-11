const { Prisma } = require('@prisma/client');
const prisma = require('../../config/database');
const { audit } = require('../../utils/audit');

/**
 * Comptage / Inventaire physique (WF#5, US-043, US-044).
 *
 * Cycle de vie d'une session : open → validated | cancelled.
 *  - Création : node + (zone ou catégorie optionnelle) → génération des lignes
 *    (1 ligne par SKU du périmètre), qty_theoretical = stock_levels.qty_physical
 *    au moment de la génération, triées par emplacement (allée > rayon > niveau).
 *  - Saisie : qty_counted par ligne, sauvegarde partielle autorisée.
 *  - Validation : pour chaque ligne comptée avec écart ≠ 0, un mouvement
 *    adjustment_in / adjustment_out (stock_moves, append-only) est créé et
 *    stock_levels est mis à jour (qty_physical, qty_available, last_counted_at),
 *    le tout dans UNE transaction.
 *
 * Logique d'ajustement : identique à stock_levels.repository.adminAdjust
 * (qty_available = max(0, qty_physical − qty_reserved), last_move_id,
 * last_counted_at). Elle est reproduite ici plutôt qu'appelée car adminAdjust
 * ouvre sa propre transaction (impossible d'imbriquer : la validation d'une
 * session doit être atomique) et n'enregistre ni l'opérateur ni le motif.
 */

const STATUSES = ['open', 'validated', 'cancelled'];
const N = (v) => Number(v ?? 0);
const round3 = (v) => Math.round(Number(v) * 1000) / 1000;
const avail = (phys, res) => Math.max(0, phys - res);

const USER_SELECT = { id: true, full_name: true };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const compareStr = (a, b) =>
  String(a ?? '').localeCompare(String(b ?? ''), 'fr', { numeric: true, sensitivity: 'base' });

/** Tri parcours physique : allée > rayon > niveau, lignes sans emplacement en dernier. */
const compareByLocation = (a, b) => {
  const la = a.location;
  const lb = b.location;
  if (la && !lb) return -1;
  if (!la && lb) return 1;
  if (la && lb) {
    const c = compareStr(la.aisle, lb.aisle)
      || compareStr(la.shelf, lb.shelf)
      || (N(la.level?.sort_order) - N(lb.level?.sort_order))
      || compareStr(la.level?.code, lb.level?.code);
    if (c) return c;
  }
  return compareStr(a.sku?.sku_code, b.sku?.sku_code);
};

const lineGap = (l) => (l.qty_counted === null || l.qty_counted === undefined
  ? null
  : round3(N(l.qty_counted) - N(l.qty_theoretical)));

const summarize = (lines) => {
  let counted = 0; let withGap = 0; let gapPlus = 0; let gapMinus = 0;
  for (const l of lines) {
    const g = lineGap(l);
    if (g === null) continue;
    counted += 1;
    if (g !== 0) {
      withGap += 1;
      if (g > 0) gapPlus += g; else gapMinus += g;
    }
  }
  return {
    lines_total: lines.length,
    lines_counted: counted,
    lines_uncounted: lines.length - counted,
    lines_with_gap: withGap,
    gap_plus: round3(gapPlus),
    gap_minus: round3(gapMinus),
    gap_net: round3(gapPlus + gapMinus),
  };
};

const usersMap = async (ids) => {
  const clean = [...new Set(ids.filter((x) => x !== null && x !== undefined))];
  if (!clean.length) return {};
  const users = await prisma.user.findMany({ where: { id: { in: clean } }, select: USER_SELECT });
  return Object.fromEntries(users.map((u) => [u.id, u]));
};

const makeReference = async (tx) => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const prefix = `CPT-${ymd}-`;
  const count = await tx.stockCountSession.count({ where: { reference: { startsWith: prefix } } });
  // suffixe aléatoire court pour éviter une collision en cas de créations simultanées
  const rnd = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}${String(count + 1).padStart(3, '0')}-${rnd}`;
};

const toNullableQty = (v, label) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw { statusCode: 400, message: `${label} : quantité comptée invalide (nombre ≥ 0 attendu)` };
  return round3(n);
};

// ─── Service ──────────────────────────────────────────────────────────────────

class StockCountService {
  // Référentiels du formulaire « Nouveau comptage »
  async getRefs() {
    const [nodes, zones, categories] = await Promise.all([
      prisma.node.findMany({
        where: { is_active: true, is_deleted: false },
        select: { id: true, code: true, name_fr: true, name_ar: true },
        orderBy: { code: 'asc' },
      }),
      prisma.zone.findMany({
        where: { is_active: true },
        select: { id: true, code: true, name_fr: true, name_ar: true },
        orderBy: { code: 'asc' },
      }),
      prisma.category.findMany({
        where: { is_active: true, is_deleted: false },
        select: { id: true, code: true, name_fr: true, name_ar: true },
        orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }],
      }),
    ]);
    return { nodes, zones, categories, statuses: STATUSES };
  }

  async list({ node_id, status, date_from, date_to, search, page = 1, limit = 20 } = {}) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(200, Math.max(1, Number(limit) || 20));
    const where = {};
    if (node_id) where.node_id = node_id;
    if (status) {
      if (!STATUSES.includes(status)) throw { statusCode: 400, message: 'Statut de comptage invalide' };
      where.status = status;
    }
    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) where.created_at.gte = new Date(date_from);
      if (date_to) {
        const end = new Date(date_to);
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(date_to))) end.setHours(23, 59, 59, 999);
        where.created_at.lte = end;
      }
    }
    if (search) where.reference = { contains: String(search), mode: 'insensitive' };

    const [sessions, total] = await Promise.all([
      prisma.stockCountSession.findMany({
        where,
        include: {
          node: { select: { id: true, code: true, name_fr: true } },
          zone: { select: { id: true, code: true, name_fr: true } },
          category: { select: { id: true, code: true, name_fr: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (p - 1) * l,
        take: l,
      }),
      prisma.stockCountSession.count({ where }),
    ]);

    const ids = sessions.map((s) => s.id);
    const lines = ids.length
      ? await prisma.stockCountLine.findMany({
        where: { session_id: { in: ids } },
        select: { session_id: true, qty_theoretical: true, qty_counted: true },
      })
      : [];
    const bySession = {};
    for (const ln of lines) (bySession[ln.session_id] ||= []).push(ln);
    const users = await usersMap(sessions.flatMap((s) => [s.created_by, s.validated_by]));

    const data = sessions.map((s) => ({
      ...s,
      created_by_user: users[s.created_by] ?? null,
      validated_by_user: users[s.validated_by] ?? null,
      summary: summarize(bySession[s.id] || []),
    }));
    return { data, pagination: { total, page: p, limit: l, pages: Math.ceil(total / l) } };
  }

  async getById(id) {
    const session = await prisma.stockCountSession.findUnique({
      where: { id },
      include: {
        node: { select: { id: true, code: true, name_fr: true, name_ar: true } },
        zone: { select: { id: true, code: true, name_fr: true } },
        category: { select: { id: true, code: true, name_fr: true } },
        lines: {
          include: {
            sku: {
              select: {
                id: true, sku_code: true, ean13: true, name_fr: true, name_ar: true,
                sku_family: { select: { id: true, name_fr: true } },
                category: { select: { id: true, name_fr: true } },
              },
            },
            location: {
              select: {
                id: true, label: true, aisle: true, shelf: true,
                level: { select: { id: true, code: true, name_fr: true, sort_order: true } },
                zone: { select: { id: true, code: true, name_fr: true } },
              },
            },
          },
        },
      },
    });
    if (!session) throw { statusCode: 404, message: 'Session de comptage introuvable' };

    // Stock physique actuel (pour signaler un stock modifié depuis la génération)
    const levels = await prisma.stockLevel.findMany({
      where: { node_id: session.node_id, sku_id: { in: session.lines.map((l) => l.sku_id) } },
      select: { sku_id: true, qty_physical: true, qty_reserved: true, last_counted_at: true },
    });
    const levelMap = Object.fromEntries(levels.map((lv) => [lv.sku_id, lv]));
    const users = await usersMap([session.created_by, session.validated_by]);

    const lines = [...session.lines].sort(compareByLocation).map((l, i) => {
      const lv = levelMap[l.sku_id];
      return {
        ...l,
        position: i + 1,
        qty_theoretical: N(l.qty_theoretical),
        qty_counted: l.qty_counted === null ? null : N(l.qty_counted),
        gap: lineGap(l),
        qty_physical_current: lv ? N(lv.qty_physical) : 0,
        stock_changed: session.status === 'open' && round3(lv ? N(lv.qty_physical) : 0) !== round3(N(l.qty_theoretical)),
      };
    });

    return {
      ...session,
      lines,
      created_by_user: users[session.created_by] ?? null,
      validated_by_user: users[session.validated_by] ?? null,
      summary: summarize(lines),
    };
  }

  // ─── Création : génère la liste de comptage ──────────────────────────────────

  async create(req, body = {}) {
    const { node_id, zone_id, category_id, notes } = body;
    if (!node_id) throw { statusCode: 400, message: 'Le node est obligatoire' };

    const node = await prisma.node.findFirst({ where: { id: node_id, is_deleted: false } });
    if (!node) throw { statusCode: 404, message: 'Node introuvable' };
    if (!node.is_active) throw { statusCode: 400, message: 'Le node est inactif' };
    if (zone_id) {
      const zone = await prisma.zone.findUnique({ where: { id: zone_id } });
      if (!zone) throw { statusCode: 404, message: 'Zone introuvable' };
    }
    if (category_id) {
      const cat = await prisma.category.findFirst({ where: { id: category_id, is_deleted: false } });
      if (!cat) throw { statusCode: 404, message: 'Catégorie introuvable' };
    }

    const skuFilter = { is_deleted: false, ...(category_id ? { category_id } : {}) };

    // Emplacements des SKU sur ce node (optionnels : un SKU peut avoir du stock sans emplacement)
    const mappings = await prisma.skuNodeLocation.findMany({
      where: {
        node_id,
        is_active: true,
        sku: skuFilter,
        location: { is_deleted: false, ...(zone_id ? { zone_id } : {}) },
      },
      include: {
        location: {
          select: {
            id: true, aisle: true, shelf: true, label: true,
            level: { select: { code: true, sort_order: true } },
          },
        },
      },
    });

    // Choix de l'emplacement par SKU : principal d'abord, sinon le premier dans l'ordre de parcours
    const locBySku = {};
    for (const m of mappings) {
      const cur = locBySku[m.sku_id];
      if (!cur) { locBySku[m.sku_id] = m; continue; }
      if (m.is_primary_location && !cur.is_primary_location) { locBySku[m.sku_id] = m; continue; }
      if (m.is_primary_location === cur.is_primary_location
        && compareByLocation({ location: m.location }, { location: cur.location }) < 0) {
        locBySku[m.sku_id] = m;
      }
    }

    let skuIds;
    if (zone_id) {
      // Périmètre zone : uniquement les SKU affectés à un emplacement de cette zone
      skuIds = Object.keys(locBySku);
    } else {
      const levels = await prisma.stockLevel.findMany({
        where: {
          node_id,
          sku: skuFilter,
          // exclut les lignes « stub » jamais mouvementées ni comptées
          OR: [
            { qty_physical: { not: 0 } },
            { last_move_id: { not: null } },
            { last_counted_at: { not: null } },
          ],
        },
        select: { sku_id: true },
      });
      skuIds = [...new Set([...levels.map((l) => l.sku_id), ...Object.keys(locBySku)])];
    }

    if (!skuIds.length) {
      throw { statusCode: 400, message: 'Aucun SKU dans le périmètre choisi (node / zone / catégorie) : rien à compter' };
    }

    // Un même SKU ne peut pas être dans deux sessions ouvertes du même node
    const overlap = await prisma.stockCountLine.findFirst({
      where: { sku_id: { in: skuIds }, session: { node_id, status: 'open' } },
      select: { session: { select: { reference: true } }, sku: { select: { sku_code: true } } },
    });
    if (overlap) {
      throw {
        statusCode: 409,
        message: `Le SKU ${overlap.sku.sku_code} est déjà en cours de comptage dans la session ouverte ${overlap.session.reference}. Validez ou annulez-la d'abord.`,
      };
    }

    const levels = await prisma.stockLevel.findMany({
      where: { node_id, sku_id: { in: skuIds } },
      select: { sku_id: true, qty_physical: true },
    });
    const physBySku = Object.fromEntries(levels.map((l) => [l.sku_id, N(l.qty_physical)]));
    const skus = await prisma.sku.findMany({ where: { id: { in: skuIds } }, select: { id: true, sku_code: true } });
    const skuById = Object.fromEntries(skus.map((s) => [s.id, s]));

    const draftLines = skuIds
      .map((sku_id) => ({
        sku_id,
        location_id: locBySku[sku_id]?.location_id ?? null,
        location: locBySku[sku_id]?.location ?? null,
        sku: skuById[sku_id],
        qty_theoretical: physBySku[sku_id] ?? 0,
      }))
      .sort(compareByLocation);

    // Création atomique session + lignes ; on rejoue la transaction en cas de collision de référence
    let session = null;
    for (let attempt = 0; attempt < 3 && !session; attempt += 1) {
      try {
        session = await prisma.$transaction(async (tx) => {
          const created = await tx.stockCountSession.create({
            data: {
              reference: await makeReference(tx),
              node_id,
              zone_id: zone_id || null,
              category_id: category_id || null,
              status: 'open',
              notes: notes ? String(notes) : null,
              created_by: req?.user?.id ?? null,
            },
          });
          await tx.stockCountLine.createMany({
            data: draftLines.map((l) => ({
              session_id: created.id,
              sku_id: l.sku_id,
              location_id: l.location_id,
              qty_theoretical: l.qty_theoretical,
            })),
          });
          await audit(req, {
            action: 'CREATE',
            resource: 'stock_count_sessions',
            resource_id: created.id,
            new_values: {
              reference: created.reference, node_id, zone_id: zone_id || null,
              category_id: category_id || null, lines: draftLines.length,
            },
          }, tx);
          return created;
        }, { timeout: 60000, maxWait: 10000 });
      } catch (e) {
        if (e?.code !== 'P2002' || attempt === 2) throw e;
      }
    }

    return this.getById(session.id);
  }

  // ─── Saisie des quantités comptées (sauvegarde partielle) ────────────────────

  async saveLines(req, id, body = {}) {
    const input = Array.isArray(body) ? body : body.lines;
    if (!Array.isArray(input) || !input.length) throw { statusCode: 400, message: 'Aucune ligne à enregistrer' };

    const session = await prisma.stockCountSession.findUnique({ where: { id }, select: { id: true, status: true, reference: true } });
    if (!session) throw { statusCode: 404, message: 'Session de comptage introuvable' };
    if (session.status !== 'open') throw { statusCode: 400, message: 'Session clôturée : saisie impossible' };

    const ids = input.map((l) => l.id).filter(Boolean);
    const existing = await prisma.stockCountLine.findMany({
      where: { session_id: id, id: { in: ids } },
      select: { id: true, qty_counted: true, note: true },
    });
    const existingMap = Object.fromEntries(existing.map((l) => [l.id, l]));

    const updates = [];
    input.forEach((l, i) => {
      if (!l.id || !existingMap[l.id]) throw { statusCode: 400, message: `Ligne ${i + 1} : ligne inconnue pour cette session` };
      const data = {};
      if (Object.prototype.hasOwnProperty.call(l, 'qty_counted')) {
        const q = toNullableQty(l.qty_counted, `Ligne ${i + 1}`);
        data.qty_counted = q;
        data.counted_at = q === null ? null : new Date();
      }
      if (Object.prototype.hasOwnProperty.call(l, 'note')) data.note = l.note ? String(l.note) : null;
      if (Object.keys(data).length) updates.push({ id: l.id, data });
    });

    if (updates.length) {
      await prisma.$transaction(
        updates.map((u) => prisma.stockCountLine.update({ where: { id: u.id }, data: u.data })),
      );
      await audit(req, {
        action: 'COUNT_ENTRY',
        resource: 'stock_count_sessions',
        resource_id: id,
        new_values: {
          reference: session.reference,
          lines: updates.map((u) => ({ id: u.id, qty_counted: u.data.qty_counted, note: u.data.note })),
        },
      });
    }
    return { saved: updates.length, session: await this.getById(id) };
  }

  // ─── Validation : génère les ajustements ─────────────────────────────────────

  async validate(req, id) {
    const pre = await prisma.stockCountSession.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!pre) throw { statusCode: 404, message: 'Session de comptage introuvable' };
    if (pre.status !== 'open') throw { statusCode: 400, message: 'Seule une session ouverte peut être validée' };

    const [moveIn, moveOut] = await Promise.all([
      prisma.moveType.findFirst({ where: { code: 'adjustment_in' } }),
      prisma.moveType.findFirst({ where: { code: 'adjustment_out' } }),
    ]);
    if (!moveIn || !moveOut) {
      throw { statusCode: 500, message: "Types de mouvement 'adjustment_in' / 'adjustment_out' absents du référentiel move_types" };
    }

    const operatorId = req?.user?.id ?? null;

    const result = await prisma.$transaction(async (tx) => {
      // Verrou logique : un seul passage open → validated (empêche une double validation)
      const now = new Date();
      const locked = await tx.stockCountSession.updateMany({
        where: { id, status: 'open' },
        data: { status: 'validated', validated_by: operatorId, validated_at: now },
      });
      if (locked.count !== 1) throw { statusCode: 409, message: 'Session déjà validée ou annulée' };

      const session = await tx.stockCountSession.findUnique({
        where: { id },
        include: { lines: { include: { sku: { select: { sku_code: true } } } } },
      });
      const counted = session.lines.filter((l) => l.qty_counted !== null);
      if (!counted.length) throw { statusCode: 400, message: 'Aucune quantité comptée : saisissez au moins une ligne avant de valider' };

      // Verrouille les niveaux de stock concernés pendant l'application des écarts
      const skuIds = counted.map((l) => l.sku_id);
      await tx.$queryRaw`SELECT id FROM stock_levels WHERE node_id = ${session.node_id}::uuid AND sku_id IN (${Prisma.join(skuIds.map((s) => Prisma.sql`${s}::uuid`))}) FOR UPDATE`;
      const levels = await tx.stockLevel.findMany({ where: { node_id: session.node_id, sku_id: { in: skuIds } } });
      const levelMap = Object.fromEntries(levels.map((l) => [l.sku_id, l]));

      const adjustments = [];
      const warnings = [];
      for (const line of counted) {
        const cur = levelMap[line.sku_id];
        const oldPhys = N(cur?.qty_physical);
        const reserved = N(cur?.qty_reserved);
        const gap = round3(N(line.qty_counted) - N(line.qty_theoretical));

        if (round3(oldPhys) !== round3(N(line.qty_theoretical))) {
          warnings.push({ sku_code: line.sku.sku_code, qty_theoretical: N(line.qty_theoretical), qty_physical_current: oldPhys });
        }

        if (gap === 0) {
          // Pas d'écart : on trace uniquement la date de comptage
          await tx.stockLevel.upsert({
            where: { node_id_sku_id: { node_id: session.node_id, sku_id: line.sku_id } },
            update: { last_counted_at: now },
            create: { node_id: session.node_id, sku_id: line.sku_id, last_counted_at: now },
          });
          continue;
        }

        // L'écart (compté − théorique) est appliqué au stock physique courant
        const newPhys = round3(Math.max(0, oldPhys + gap));
        const applied = round3(newPhys - oldPhys);
        if (applied === 0) {
          await tx.stockLevel.upsert({
            where: { node_id_sku_id: { node_id: session.node_id, sku_id: line.sku_id } },
            update: { last_counted_at: now },
            create: { node_id: session.node_id, sku_id: line.sku_id, last_counted_at: now },
          });
          continue;
        }
        const newAvail = avail(newPhys, reserved);

        const move = await tx.stockMove.create({
          data: {
            node_id: session.node_id,
            sku_id: line.sku_id,
            move_type_id: applied > 0 ? moveIn.id : moveOut.id,
            qty_delta: applied,
            reference: session.reference,
            operator_id: operatorId,
            reason: `Comptage physique ${session.reference} : compté ${N(line.qty_counted)} / théorique ${N(line.qty_theoretical)}${line.note ? ` — ${line.note}` : ''}`,
            metadata: {
              source: 'stock_count',
              session_id: session.id,
              session_reference: session.reference,
              line_id: line.id,
              qty_theoretical: N(line.qty_theoretical),
              qty_counted: N(line.qty_counted),
              gap,
              qty_before: oldPhys,
              qty_after: newPhys,
            },
          },
        });
        await tx.stockLevel.upsert({
          where: { node_id_sku_id: { node_id: session.node_id, sku_id: line.sku_id } },
          update: { qty_physical: newPhys, qty_available: newAvail, last_move_id: move.id, last_counted_at: now },
          create: {
            node_id: session.node_id, sku_id: line.sku_id,
            qty_physical: newPhys, qty_available: newAvail, last_move_id: move.id, last_counted_at: now,
          },
        });
        adjustments.push({
          move_id: move.id, sku_id: line.sku_id, sku_code: line.sku.sku_code,
          qty_delta: applied, qty_before: oldPhys, qty_after: newPhys,
        });
      }

      await audit(req, {
        action: 'VALIDATE',
        resource: 'stock_count_sessions',
        resource_id: session.id,
        old_values: { status: 'open' },
        new_values: {
          status: 'validated',
          reference: session.reference,
          lines_counted: counted.length,
          lines_uncounted: session.lines.length - counted.length,
          adjustments,
        },
      }, tx);

      return {
        adjustments_count: adjustments.length,
        lines_counted: counted.length,
        lines_uncounted: session.lines.length - counted.length,
        adjustments,
        warnings,
      };
    }, { timeout: 120000, maxWait: 10000 });

    return { ...result, session: await this.getById(id) };
  }

  async cancel(req, id, body = {}) {
    const session = await prisma.stockCountSession.findUnique({ where: { id }, select: { id: true, status: true, reference: true, notes: true } });
    if (!session) throw { statusCode: 404, message: 'Session de comptage introuvable' };
    if (session.status !== 'open') throw { statusCode: 400, message: 'Seule une session ouverte peut être annulée' };

    const reason = body?.reason ? String(body.reason).trim() : '';
    const notes = reason ? `${session.notes ? `${session.notes}\n` : ''}Annulation : ${reason}` : session.notes;
    const upd = await prisma.stockCountSession.updateMany({
      where: { id, status: 'open' },
      data: { status: 'cancelled', notes },
    });
    if (upd.count !== 1) throw { statusCode: 409, message: 'Session déjà validée ou annulée' };

    await audit(req, {
      action: 'CANCEL',
      resource: 'stock_count_sessions',
      resource_id: id,
      old_values: { status: 'open' },
      new_values: { status: 'cancelled', reference: session.reference, reason: reason || null },
    });
    return this.getById(id);
  }
}

module.exports = new StockCountService();
