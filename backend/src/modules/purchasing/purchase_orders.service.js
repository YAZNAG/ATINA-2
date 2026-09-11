/**
 * Bons de commande fournisseur (purchase_orders / purchase_order_items) — US-052 à US-055,
 * réception de marchandises (WF #2, US-054).
 *
 * Cycle de vie : draft → sent (« Valider ») → in_transit → partially_received / received.
 * Annulation (cancelled) et suppression (soft-delete) interdites dès qu'une réception a eu lieu.
 *
 * Unités : qty_ordered / qty_received sont en UNITÉ D'ACHAT (Schema V3). Les mouvements de
 * stock sont en unité de vente : quantité stock = quantité reçue × skus.coeff, coût du lot =
 * coût unitaire d'achat ÷ coeff (coeff = 1 par défaut → aucune conversion).
 *
 * qty_incoming (stock_levels) : les quantités d'un BC validé (sent / in_transit /
 * partially_received) sont comptées « en commande » ; la réception les décrémente (même
 * logique que POST /stock/levels/receipt), l'annulation ou la clôture libère le reliquat.
 */
const prisma = require('../../config/database');
const { audit } = require('../../utils/audit');
const priceService = require('./supplier_prices.service');
const skuCost = require('../stock/sku_costs/sku_cost.util');
const {
  PO_TRANSITIONS, LINES_EDITABLE_STATUSES, HEADER_EDITABLE_STATUSES, RECEIVABLE_STATUSES,
  INCOMING_STATUSES, bad, assertUuid, isUuid, num, round, optText, parseNumber, parseDateOnly,
  parseBool, todayDateOnly, addDays, fmtDate, pagination, pageMeta, isUniqueViolation,
} = require('./purchasing.shared');

const N = (v) => Number(v ?? 0);
const q3 = (v) => round(v, 3);

const SKU_SELECT = {
  id: true, sku_code: true, name_fr: true, name_ar: true, ean13: true,
  unit_purchase: true, unit_sale: true, coeff: true, is_active: true,
};

const INCLUDE_LIST = {
  supplier: { select: { id: true, code: true, name_fr: true, name_ar: true, is_active: true, is_deleted: true } },
  node: { select: { id: true, code: true, name_fr: true, name_ar: true } },
  status: true,
  _count: { select: { items: true } },
};

const INCLUDE_DETAIL = {
  supplier: {
    select: {
      id: true, code: true, name_fr: true, name_ar: true, is_active: true, is_deleted: true,
      contact_name: true, contact_phone: true, contact_email: true, payment_terms: true, lead_time_days: true,
    },
  },
  node: { select: { id: true, code: true, name_fr: true, name_ar: true } },
  status: true,
  items: { include: { sku: { select: SKU_SELECT } }, orderBy: { created_at: 'asc' } },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function statusByCode(code, client = prisma) {
  const s = await client.poStatus.findUnique({ where: { code } });
  if (!s) throw bad(`Statut de BC « ${code} » absent du référentiel po_statuses`, 500);
  return s;
}

async function userNames(ids) {
  const clean = [...new Set(ids.filter((x) => Number.isInteger(x)))];
  if (!clean.length) return {};
  const users = await prisma.user.findMany({ where: { id: { in: clean } }, select: { id: true, full_name: true } });
  return Object.fromEntries(users.map((u) => [u.id, u.full_name]));
}

function formatItem(it) {
  const qo = N(it.qty_ordered);
  const qr = N(it.qty_received);
  const price = N(it.unit_price_ht);
  return {
    id: it.id,
    po_id: it.po_id,
    sku_id: it.sku_id,
    sku: it.sku ? { ...it.sku, coeff: N(it.sku.coeff) || 1 } : undefined,
    qty_ordered: qo,
    qty_received: qr,
    qty_remaining: q3(Math.max(0, qo - qr)),
    qty_gap: q3(qr - qo),
    unit_price_ht: price,
    line_total_ht: round(qo * price, 2),
    received_value_ht: round(qr * price, 2),
    created_at: it.created_at,
    updated_at: it.updated_at,
  };
}

/** Statut terminal (po_statuses.is_terminal : received, cancelled) → plus aucune modification. */
const isTerminal = (status) => !!status?.is_terminal || ['received', 'cancelled'].includes(status?.code);

function assertNotTerminal(po, action = 'modifié') {
  if (isTerminal(po.status)) {
    throw bad(`Le BC ${po.reference} est au statut terminal « ${po.status.name_fr} » : il ne peut plus être ${action}`);
  }
}

function flags(po) {
  const code = po.status?.code;
  const anyReceived = (po.items || []).some((i) => N(i.qty_received) > 0);
  const deleted = !!po.is_deleted;
  const locked = deleted || isTerminal(po.status);
  return {
    is_terminal: isTerminal(po.status),
    allowed_transitions: locked ? [] : (PO_TRANSITIONS[code] || []).filter((t) => t !== 'cancelled' || !anyReceived),
    can_edit_lines: !locked && LINES_EDITABLE_STATUSES.includes(code),
    can_edit_header: !locked && HEADER_EDITABLE_STATUSES.includes(code),
    can_change_parties: !locked && code === 'draft',
    can_receive: !locked && RECEIVABLE_STATUSES.includes(code),
    can_cancel: !locked && ['draft', 'sent', 'in_transit'].includes(code) && !anyReceived,
    // Archivage (soft-delete) : encore possible pour un BC annulé, jamais après réception.
    can_delete: !deleted && !['partially_received', 'received'].includes(code) && !anyReceived,
  };
}

function format(po, names = {}) {
  if (!po) return po;
  const { _count, items, ...rest } = po;
  const out = {
    ...rest,
    total_ht: num(po.total_ht) ?? 0,
    expected_at: fmtDate(po.expected_at),
    created_by_name: po.created_by != null ? names[po.created_by] ?? null : null,
    items_count: _count?.items ?? items?.length ?? 0,
  };
  if (items) {
    out.items = items.map(formatItem);
    const ordered = out.items.reduce((s, i) => s + i.qty_ordered, 0);
    const received = out.items.reduce((s, i) => s + Math.min(i.qty_received, i.qty_ordered), 0);
    out.qty_ordered_total = q3(ordered);
    out.qty_received_total = q3(out.items.reduce((s, i) => s + i.qty_received, 0));
    out.progress_pct = ordered > 0 ? Math.round((received / ordered) * 100) : 0;
    out.received_value_ht = round(out.items.reduce((s, i) => s + i.received_value_ht, 0), 2);
  }
  Object.assign(out, flags(po));
  return out;
}

async function loadPo(id, client = prisma, { includeDeleted = false } = {}) {
  assertUuid(id, 'Identifiant du bon de commande');
  const po = await client.purchaseOrder.findFirst({
    where: { id, ...(includeDeleted ? {} : { is_deleted: false }) },
    include: INCLUDE_DETAIL,
  });
  if (!po) throw bad('Bon de commande introuvable', 404);
  return po;
}

/** Verrouille la ligne purchase_orders pendant la transaction (réceptions / transitions concurrentes). */
async function lockPo(tx, id) {
  await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${id}::uuid FOR UPDATE`;
}

async function lockLevel(tx, node_id, sku_id) {
  await tx.$queryRaw`SELECT id FROM stock_levels WHERE node_id = ${node_id}::uuid AND sku_id = ${sku_id}::uuid FOR UPDATE`;
}

/** Même logique que StockLevelRepository.updateIncoming, dans la transaction courante. */
async function adjustIncoming(tx, node_id, sku_id, delta) {
  const d = q3(delta);
  if (!d) return;
  await lockLevel(tx, node_id, sku_id);
  const cur = await tx.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });
  const new_inc = q3(Math.max(0, N(cur?.qty_incoming) + d));
  await tx.stockLevel.upsert({
    where: { node_id_sku_id: { node_id, sku_id } },
    update: { qty_incoming: new_inc, updated_at: new Date() },
    create: { node_id, sku_id, qty_incoming: new_inc },
  });
}

const coeffOf = (sku) => (N(sku?.coeff) > 0 ? N(sku.coeff) : 1);

/** Libère (ou ajoute, sign = +1) le reliquat non reçu de chaque ligne dans qty_incoming. */
async function applyIncomingForPo(tx, po, sign) {
  for (const it of po.items) {
    const remaining = Math.max(0, N(it.qty_ordered) - N(it.qty_received));
    if (remaining > 0) await adjustIncoming(tx, po.node_id, it.sku_id, sign * remaining * coeffOf(it.sku));
  }
}

function todayRefPrefix() {
  const n = new Date();
  return `PO-${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, '0')}${String(n.getDate()).padStart(2, '0')}-`;
}

async function nextReference(tx) {
  const prefix = todayRefPrefix();
  const last = await tx.purchaseOrder.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? (parseInt(last.reference.slice(prefix.length), 10) || 0) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function assertSupplierUsable(supplier_id, client = prisma) {
  assertUuid(supplier_id, 'Fournisseur');
  const s = await client.supplier.findFirst({ where: { id: supplier_id, is_deleted: false } });
  if (!s) throw bad('Fournisseur introuvable', 404);
  if (!s.is_active) throw bad(`Le fournisseur ${s.name_fr} est inactif : il ne peut pas être utilisé sur un bon de commande`);
  return s;
}

async function assertNodeUsable(node_id, client = prisma) {
  assertUuid(node_id, 'Node');
  const n = await client.node.findFirst({ where: { id: node_id, is_deleted: false } });
  if (!n) throw bad('Node (dark store) introuvable', 404);
  if (!n.is_active) throw bad(`Le node ${n.name_fr} est inactif`);
  return n;
}

/**
 * Valide les lignes { sku_id, qty_ordered, unit_price_ht? }. Sans prix saisi, le prix
 * fournisseur applicable (supplier_prices, palier + validité) est repris.
 */
async function readItems(items, supplier_id) {
  if (!Array.isArray(items) || !items.length) throw bad('Ajoutez au moins une ligne (SKU + quantité)');
  const seen = new Set();
  const lines = items.map((raw, idx) => {
    const n = idx + 1;
    if (!isUuid(raw?.sku_id)) throw bad(`Ligne ${n} : SKU requis`);
    if (seen.has(raw.sku_id)) throw bad(`Ligne ${n} : ce SKU figure déjà sur une autre ligne, regroupez les quantités`);
    seen.add(raw.sku_id);
    const qty_ordered = parseNumber(raw.qty_ordered, `Ligne ${n} : quantité commandée`, { gt: 0, required: true });
    const unit_price_ht = parseNumber(raw.unit_price_ht, `Ligne ${n} : prix HT`, { min: 0 });
    return { sku_id: raw.sku_id, qty_ordered: q3(qty_ordered), unit_price_ht: unit_price_ht ?? null, n };
  });

  const skus = await prisma.sku.findMany({
    where: { id: { in: lines.map((l) => l.sku_id) }, is_deleted: false, deleted_at: null },
    select: SKU_SELECT,
  });
  const byId = Object.fromEntries(skus.map((s) => [s.id, s]));
  for (const l of lines) {
    const sku = byId[l.sku_id];
    if (!sku) throw bad(`Ligne ${l.n} : SKU introuvable ou supprimé`);
    l.sku = sku;
    if (l.unit_price_ht === null) {
      const p = await priceService.findApplicable({ supplier_id, sku_id: l.sku_id, qty: l.qty_ordered });
      if (!p) throw bad(`Ligne ${l.n} (${sku.sku_code}) : aucun prix fournisseur applicable, saisissez le prix HT`);
      l.unit_price_ht = p.price_ht;
    }
    l.unit_price_ht = round(l.unit_price_ht, 4);
  }
  return lines;
}

const totalOf = (lines) => round(lines.reduce((s, l) => s + N(l.qty_ordered) * N(l.unit_price_ht), 0), 2);

// ─── Lecture ─────────────────────────────────────────────────────────────────

function buildWhere(query = {}) {
  const where = {};
  if (parseBool(query.deleted)) where.is_deleted = true;
  else where.is_deleted = false;
  if (query.supplier_id) where.supplier_id = assertUuid(query.supplier_id, 'Fournisseur');
  if (query.node_id) where.node_id = assertUuid(query.node_id, 'Node');
  if (query.status) {
    const codes = String(query.status).split(',').map((s) => s.trim()).filter(Boolean);
    where.status = { code: codes.length > 1 ? { in: codes } : codes[0] };
  }
  const field = query.date_field === 'expected_at' ? 'expected_at' : 'created_at';
  const from = parseDateOnly(query.date_from, 'Date de début');
  const to = parseDateOnly(query.date_to, 'Date de fin');
  if (from || to) {
    where[field] = {};
    if (from) where[field].gte = from;
    if (to) where[field][field === 'created_at' ? 'lt' : 'lte'] = field === 'created_at' ? addDays(to, 1) : to;
  }
  if (query.sku_id) where.items = { some: { sku_id: assertUuid(query.sku_id, 'SKU') } };
  const search = String(query.search || '').trim();
  if (search) {
    where.OR = [
      { reference: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
      { supplier: { name_fr: { contains: search, mode: 'insensitive' } } },
      { supplier: { code: { contains: search, mode: 'insensitive' } } },
    ];
  }
  return where;
}

async function list(query = {}) {
  const where = buildWhere(query);
  const all = parseBool(query.all);
  const { page, limit, skip } = pagination(query);
  const [rows, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where, include: INCLUDE_LIST, orderBy: { created_at: 'desc' },
      ...(all ? { take: 5000 } : { skip, take: limit }),
    }),
    prisma.purchaseOrder.count({ where }),
  ]);
  const names = await userNames(rows.map((r) => r.created_by));
  return {
    data: rows.map((r) => format(r, names)),
    pagination: all ? pageMeta(total, 1, Math.max(1, total)) : pageMeta(total, page, limit),
  };
}

const LOCATION_SELECT = {
  id: true, label: true, aisle: true, shelf: true,
  zone: { select: { id: true, code: true, name_fr: true } },
  level: { select: { id: true, code: true, name_fr: true, sort_order: true } },
};

async function getById(id) {
  const po = await loadPo(id, prisma, { includeDeleted: true });
  const itemIds = po.items.map((i) => i.id);
  const skuIds = po.items.map((i) => i.sku_id);
  const [names, moves, cumps, snapshots] = await Promise.all([
    userNames([po.created_by]),
    prisma.stockMove.findMany({
      where: {
        node_id: po.node_id,
        OR: [{ reference: po.reference }, ...(itemIds.length ? [{ po_item_id: { in: itemIds } }] : [])],
      },
      include: {
        lot: { select: { id: true, lot_number: true, expiry_date: true, cost_unit: true, qty_initial: true, qty_remaining: true } },
        sku: { select: { id: true, sku_code: true, name_fr: true } },
        move_type: { select: { code: true, name_fr: true } },
        operator: { select: { id: true, full_name: true } },
        location: { select: LOCATION_SELECT },
        cost_snapshots: { select: { id: true, cump: true, computed_at: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
    skuCost.latestBySkus(prisma, po.node_id, skuIds),
    skuIds.length
      ? prisma.skuCostSnapshot.findMany({
        where: { node_id: po.node_id, sku_id: { in: skuIds } },
        orderBy: { computed_at: 'desc' },
        take: 200,
        include: { triggered_by_move: { select: { id: true, reference: true, qty_delta: true, po_item_id: true } } },
      })
      : [],
  ]);
  const out = format(po, names);
  const skuById = Object.fromEntries(po.items.map((i) => [i.sku_id, i.sku]));
  out.items = out.items.map((i) => ({
    ...i,
    cump_current: cumps[i.sku_id]?.cump ?? null,
    cump_computed_at: cumps[i.sku_id]?.computed_at ?? null,
  }));
  out.receptions = moves.map((m) => ({
    id: m.id,
    created_at: m.created_at,
    sku: m.sku,
    qty_delta: N(m.qty_delta),
    move_type: m.move_type,
    operator: m.operator,
    reason: m.reason,
    metadata: m.metadata,
    po_item_id: m.po_item_id,
    location: m.location,
    cump_after: m.cost_snapshots?.[0] ? N(m.cost_snapshots[0].cump) : null,
    lot: m.lot ? {
      ...m.lot,
      expiry_date: fmtDate(m.lot.expiry_date),
      cost_unit: N(m.lot.cost_unit),
      qty_initial: N(m.lot.qty_initial),
      qty_remaining: N(m.lot.qty_remaining),
    } : null,
  }));
  // Historique CUMP (US-047) des SKU du BC sur le node de réception.
  out.cump_history = snapshots.map((s) => ({
    id: s.id,
    sku_id: s.sku_id,
    sku: skuById[s.sku_id] ? { id: s.sku_id, sku_code: skuById[s.sku_id].sku_code, name_fr: skuById[s.sku_id].name_fr } : null,
    cump: N(s.cump),
    computed_at: s.computed_at,
    move: s.triggered_by_move ? { ...s.triggered_by_move, qty_delta: N(s.triggered_by_move.qty_delta) } : null,
    from_this_po: !!(s.triggered_by_move?.po_item_id && itemIds.includes(s.triggered_by_move.po_item_id)),
  }));
  return out;
}

/** Emplacements actifs d'un node (choix optionnel de l'emplacement de stockage à la réception). */
async function nodeLocations(query = {}) {
  const node_id = assertUuid(query.node_id, 'Node');
  const rows = await prisma.warehouseLocation.findMany({
    where: { node_id, is_deleted: false, is_active: true },
    select: LOCATION_SELECT,
  });
  const cmp = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'fr', { numeric: true, sensitivity: 'base' });
  return rows.sort((a, b) => cmp(a.zone?.code, b.zone?.code) || cmp(a.aisle, b.aisle) || cmp(a.shelf, b.shelf)
    || (N(a.level?.sort_order) - N(b.level?.sort_order)));
}

// ─── Création / modification ─────────────────────────────────────────────────

async function create(body = {}, req) {
  const supplier = await assertSupplierUsable(body.supplier_id);
  const node = await assertNodeUsable(body.node_id);
  const lines = await readItems(body.items, supplier.id);
  const notes = optText(body.notes, 5000, 'Notes') ?? null;
  let expected_at = parseDateOnly(body.expected_at, 'Date de livraison prévue');
  if (!expected_at) expected_at = addDays(todayDateOnly(), N(supplier.lead_time_days) || 0);
  const validate = parseBool(body.validate) || body.status === 'sent';

  let po;
  for (let attempt = 0; attempt < 5 && !po; attempt += 1) {
    try {
      po = await prisma.$transaction(async (tx) => {
        const draft = await statusByCode('draft', tx);
        const sent = validate ? await statusByCode('sent', tx) : null;
        const reference = await nextReference(tx);
        const created = await tx.purchaseOrder.create({
          data: {
            reference,
            supplier_id: supplier.id,
            node_id: node.id,
            status_id: (sent || draft).id,
            ...(sent ? { ordered_at: new Date() } : {}),
            expected_at,
            notes,
            total_ht: totalOf(lines),
            created_by: req?.user?.id ?? null,
            items: {
              create: lines.map((l) => ({ sku_id: l.sku_id, qty_ordered: l.qty_ordered, unit_price_ht: l.unit_price_ht })),
            },
          },
          include: INCLUDE_DETAIL,
        });
        if (validate) await applyIncomingForPo(tx, created, +1);
        return created;
      });
    } catch (err) {
      if (!(isUniqueViolation(err) && String(err.meta?.target || '').includes('reference'))) throw err;
    }
  }
  if (!po) throw bad('Impossible de générer une référence de BC unique, réessayez', 409);

  await audit(req, { action: 'CREATE', resource: 'purchase_orders', resource_id: po.id, new_values: format(po) });
  return getById(po.id);
}

async function update(id, body = {}, req) {
  const before = await loadPo(id);
  assertNotTerminal(before);
  const code = before.status.code;
  const data = {};
  let newLines = null;

  const wantsParties = (body.supplier_id && body.supplier_id !== before.supplier_id)
    || (body.node_id && body.node_id !== before.node_id);
  if (wantsParties) {
    if (code !== 'draft') throw bad('Le fournisseur et le node ne sont modifiables que sur un BC en brouillon');
    if (body.supplier_id && body.supplier_id !== before.supplier_id) data.supplier_id = (await assertSupplierUsable(body.supplier_id)).id;
    if (body.node_id && body.node_id !== before.node_id) data.node_id = (await assertNodeUsable(body.node_id)).id;
  }

  const headerTouched = body.expected_at !== undefined || body.notes !== undefined;
  if (headerTouched && !HEADER_EDITABLE_STATUSES.includes(code)) {
    throw bad(`Un BC au statut « ${before.status.name_fr} » n'est plus modifiable`);
  }
  if (body.expected_at !== undefined) data.expected_at = parseDateOnly(body.expected_at, 'Date de livraison prévue');
  if (body.notes !== undefined) data.notes = optText(body.notes, 5000, 'Notes');

  if (body.items !== undefined) {
    if (!LINES_EDITABLE_STATUSES.includes(code)) {
      throw bad(`Les lignes d'un BC au statut « ${before.status.name_fr} » ne sont plus modifiables (modification possible en Brouillon ou Envoyé uniquement)`);
    }
    newLines = await readItems(body.items, data.supplier_id || before.supplier_id);
    data.total_ht = totalOf(newLines);
  }
  if (!Object.keys(data).length) throw bad('Aucune modification fournie');

  await prisma.$transaction(async (tx) => {
    await lockPo(tx, id);
    const fresh = await loadPo(id, tx);
    if (fresh.status.code !== code) throw bad('Le statut du BC a changé entre-temps, rechargez la page', 409);

    if (newLines) {
      const oldBySku = Object.fromEntries(fresh.items.map((i) => [i.sku_id, i]));
      const newBySku = Object.fromEntries(newLines.map((l) => [l.sku_id, l]));
      // Lignes retirées (aucune réception possible à ce stade : statut draft / sent).
      const removed = fresh.items.filter((i) => !newBySku[i.sku_id]);
      if (removed.length) await tx.purchaseOrderItem.deleteMany({ where: { id: { in: removed.map((i) => i.id) } } });
      for (const l of newLines) {
        const old = oldBySku[l.sku_id];
        if (old) {
          await tx.purchaseOrderItem.update({ where: { id: old.id }, data: { qty_ordered: l.qty_ordered, unit_price_ht: l.unit_price_ht } });
        } else {
          await tx.purchaseOrderItem.create({ data: { po_id: id, sku_id: l.sku_id, qty_ordered: l.qty_ordered, unit_price_ht: l.unit_price_ht } });
        }
      }
      if (INCOMING_STATUSES.includes(code)) {
        for (const i of removed) await adjustIncoming(tx, fresh.node_id, i.sku_id, -N(i.qty_ordered) * coeffOf(i.sku));
        for (const l of newLines) {
          const delta = N(l.qty_ordered) - N(oldBySku[l.sku_id]?.qty_ordered);
          if (delta) await adjustIncoming(tx, fresh.node_id, l.sku_id, delta * coeffOf(l.sku));
        }
      }
    }
    await tx.purchaseOrder.update({ where: { id }, data });
  });

  const after = await getById(id);
  await audit(req, { action: 'UPDATE', resource: 'purchase_orders', resource_id: id, old_values: format(before), new_values: after });
  return after;
}

// ─── Statuts ─────────────────────────────────────────────────────────────────

async function changeStatus(id, body = {}, req) {
  const target = String(body.status || body.status_code || '').trim();
  if (!target) throw bad('Statut cible requis');
  const reason = optText(body.reason, 500, 'Motif') ?? null;

  const result = await prisma.$transaction(async (tx) => {
    await lockPo(tx, id);
    const po = await loadPo(id, tx);
    assertNotTerminal(po, 'changé de statut');
    const from = po.status.code;
    const allowed = PO_TRANSITIONS[from] || [];
    if (!allowed.includes(target)) {
      const targetStatus = await tx.poStatus.findUnique({ where: { code: target } });
      throw bad(`Transition impossible : « ${po.status.name_fr} » → « ${targetStatus?.name_fr || target} »`);
    }
    const anyReceived = po.items.some((i) => N(i.qty_received) > 0);
    const data = { status_id: (await statusByCode(target, tx)).id };

    if (target === 'sent') {
      if (!po.items.length) throw bad('Impossible de valider un BC sans ligne');
      await assertSupplierUsable(po.supplier_id, tx);
      await assertNodeUsable(po.node_id, tx);
      await applyIncomingForPo(tx, po, +1);
      data.ordered_at = new Date(); // purchase_orders.ordered_at = envoi au fournisseur
    } else if (target === 'cancelled') {
      if (anyReceived) throw bad('Annulation interdite : ce BC a déjà fait l\'objet d\'une réception');
      if (INCOMING_STATUSES.includes(from)) await applyIncomingForPo(tx, po, -1);
    } else if (target === 'received') {
      // Clôture d'un BC partiellement reçu : le reliquat non livré est abandonné.
      await applyIncomingForPo(tx, po, -1);
      if (!po.received_at) data.received_at = new Date();
    }
    await tx.purchaseOrder.update({ where: { id }, data });
    return { from, to: target };
  });

  await audit(req, {
    action: result.to === 'cancelled' ? 'CANCEL' : result.to === 'sent' ? 'VALIDATE' : 'STATUS_CHANGE',
    resource: 'purchase_orders',
    resource_id: id,
    old_values: { status: result.from },
    new_values: { status: result.to, reason },
  });
  return getById(id);
}

/** Soft-delete (US-055) : interdit après réception partielle ou totale. */
async function remove(id, req) {
  const before = await prisma.$transaction(async (tx) => {
    await lockPo(tx, id);
    const po = await loadPo(id, tx);
    const code = po.status.code;
    if (['partially_received', 'received'].includes(code) || po.items.some((i) => N(i.qty_received) > 0)) {
      throw bad('Suppression interdite : ce BC a déjà fait l\'objet d\'une réception');
    }
    if (INCOMING_STATUSES.includes(code)) await applyIncomingForPo(tx, po, -1);
    const cancelled = await statusByCode('cancelled', tx);
    await tx.purchaseOrder.update({
      where: { id },
      data: { is_deleted: true, deleted_at: new Date(), status_id: cancelled.id },
    });
    return po;
  });
  await audit(req, {
    action: 'DELETE',
    resource: 'purchase_orders',
    resource_id: id,
    old_values: { reference: before.reference, status: before.status.code, total_ht: num(before.total_ht) },
    new_values: { is_deleted: true, status: 'cancelled' },
  });
  return { id, reference: before.reference, is_deleted: true };
}

// ─── Réception (WF #2 / US-054) ──────────────────────────────────────────────

/**
 * body = { lines: [{ item_id, qty_received, lot_number?, expiry_date?, cost_unit?, location_id? }], received_at?, notes? }
 * qty_received = quantité reçue LORS DE CETTE RÉCEPTION (unité d'achat), ≤ reliquat.
 *
 * Dans UNE transaction, pour chaque ligne : création stock_lots + stock_moves (type
 * « reception ») + mise à jour stock_levels (même logique que StockLevelRepository.applyReceipt :
 * +physique, allocation des backorders, −incoming, disponible = physique − réservé), puis
 * purchase_order_items.qty_received et statut du BC (partially_received / received).
 * Le lot et le mouvement portent po_item_id et l'emplacement optionnel (location_id, qui
 * alimente aussi sku_node_locations.qty_physical) ; le CUMP du couple SKU × node est
 * recalculé (sku_cost_snapshots, voir stock/sku_costs/sku_cost.util.js).
 */
async function receive(id, body = {}, req) {
  const rawLines = Array.isArray(body.lines) ? body.lines : Array.isArray(body.items) ? body.items : null;
  if (!rawLines || !rawLines.length) throw bad('Aucune ligne à réceptionner');
  const receivedAt = parseDateOnly(body.received_at, 'Date de réception');
  const receptionDate = receivedAt ? new Date(`${fmtDate(receivedAt)}T12:00:00.000Z`) : new Date();
  if (receivedAt && receivedAt > todayDateOnly()) throw bad('La date de réception ne peut pas être dans le futur');
  const notes = optText(body.notes, 1000, 'Commentaire') ?? null;
  const today = todayDateOnly();

  const parsed = rawLines.map((l, idx) => {
    const n = idx + 1;
    if (!isUuid(l?.item_id || l?.id)) throw bad(`Ligne ${n} : identifiant de ligne de BC invalide`);
    const qty = parseNumber(l.qty_received ?? l.qty, `Ligne ${n} : quantité reçue`, { min: 0 }) ?? 0;
    const expiry = parseDateOnly(l.expiry_date, `Ligne ${n} : date d'expiration`) ?? null;
    if (expiry && expiry < today) throw bad(`Ligne ${n} : la date d'expiration (${fmtDate(expiry)}) est déjà dépassée`);
    return {
      n,
      item_id: l.item_id || l.id,
      qty: q3(qty),
      lot_number: optText(l.lot_number, 100, `Ligne ${n} : n° de lot`) ?? null,
      expiry_date: expiry,
      cost_unit: parseNumber(l.cost_unit, `Ligne ${n} : coût unitaire`, { min: 0 }),
      location_id: l.location_id ? assertUuid(l.location_id, `Ligne ${n} : emplacement`) : null,
    };
  }).filter((l) => l.qty > 0);
  if (!parsed.length) throw bad('Saisissez une quantité reçue > 0 sur au moins une ligne');

  const moveType = await prisma.moveType.findFirst({ where: { code: { in: ['reception', 'receipt'] } }, orderBy: { code: 'asc' } });
  const operatorId = Number.isInteger(req?.user?.id) ? req.user.id : null;

  const result = await prisma.$transaction(async (tx) => {
    await lockPo(tx, id);
    const po = await loadPo(id, tx);
    assertNotTerminal(po, 'réceptionné');
    const from = po.status.code;
    if (!RECEIVABLE_STATUSES.includes(from)) {
      throw bad(`Réception impossible : BC au statut « ${po.status.name_fr} » (réception possible en Envoyé, En transit ou Partiellement reçu)`);
    }
    const itemsById = Object.fromEntries(po.items.map((i) => [i.id, i]));
    const seen = new Set();
    const created = [];

    // Emplacements saisis : doivent appartenir au node de réception, actifs et non supprimés.
    const locIds = [...new Set(parsed.map((l) => l.location_id).filter(Boolean))];
    const locations = locIds.length
      ? await tx.warehouseLocation.findMany({ where: { id: { in: locIds } }, select: { id: true, node_id: true, label: true, is_active: true, is_deleted: true } })
      : [];
    const locById = Object.fromEntries(locations.map((x) => [x.id, x]));
    for (const l of parsed) {
      if (!l.location_id) continue;
      const loc = locById[l.location_id];
      if (!loc || loc.is_deleted) throw bad(`Ligne ${l.n} : emplacement introuvable`);
      if (loc.node_id !== po.node_id) throw bad(`Ligne ${l.n} : l'emplacement ${loc.label} n'appartient pas au node ${po.node?.name_fr || ''}`);
      if (!loc.is_active) throw bad(`Ligne ${l.n} : l'emplacement ${loc.label} est inactif`);
    }

    for (const l of parsed) {
      const item = itemsById[l.item_id];
      if (!item) throw bad(`Ligne ${l.n} : cette ligne n'appartient pas au BC ${po.reference}`);
      if (seen.has(l.item_id)) throw bad(`Ligne ${l.n} : ligne de BC saisie deux fois`);
      seen.add(l.item_id);
      const remaining = q3(N(item.qty_ordered) - N(item.qty_received));
      if (l.qty > remaining) {
        throw bad(`${item.sku.sku_code} : quantité reçue (${l.qty}) supérieure au reliquat à recevoir (${remaining})`);
      }

      const coeff = coeffOf(item.sku);
      const stockQty = q3(l.qty * coeff);
      const costPurchase = l.cost_unit ?? N(item.unit_price_ht);
      const costUnit = round(costPurchase / coeff, 4);
      const { node_id } = po;
      const { sku_id } = item;

      // ── Logique StockLevelRepository.applyReceipt, dans la transaction du BC ──
      await lockLevel(tx, node_id, sku_id);
      const cur = await tx.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });
      const old_phys = N(cur?.qty_physical);
      const old_res = N(cur?.qty_reserved);
      const old_back = N(cur?.qty_backordered);
      const old_inc = N(cur?.qty_incoming);
      const new_phys = q3(old_phys + stockQty);
      const allocated = cur && old_back > 0 ? Math.min(stockQty, old_back) : 0;
      const new_res = q3(old_res + allocated);
      const new_back = q3(old_back - allocated);
      const new_inc = q3(Math.max(0, old_inc - stockQty));
      const new_avail = q3(Math.max(0, new_phys - new_res));

      const lot = await tx.stockLot.create({
        data: {
          sku_id, node_id,
          po_item_id: item.id,
          location_id: l.location_id,
          qty_initial: stockQty,
          qty_remaining: stockQty,
          cost_unit: costUnit,
          lot_number: l.lot_number,
          expiry_date: l.expiry_date,
          received_at: receptionDate,
        },
      });
      const move = await tx.stockMove.create({
        data: {
          node_id, sku_id,
          move_type_id: moveType?.id ?? null,
          lot_id: lot.id,
          po_item_id: item.id,
          location_id: l.location_id,
          qty_delta: stockQty,
          reference: po.reference,
          operator_id: operatorId,
          reason: `Réception BC ${po.reference}${notes ? ` — ${notes}` : ''}`,
          metadata: {
            source: 'purchase_order',
            po_id: po.id,
            po_item_id: item.id,
            po_reference: po.reference,
            qty_purchase_unit: l.qty,
            coeff,
            cost_unit_purchase: costPurchase,
            lot_number: l.lot_number,
            expiry_date: fmtDate(l.expiry_date),
            location_id: l.location_id,
            location_label: l.location_id ? locById[l.location_id].label : null,
            qty_before: old_phys,
            qty_after: new_phys,
          },
        },
      });
      await tx.stockLevel.upsert({
        where: { node_id_sku_id: { node_id, sku_id } },
        update: { qty_physical: new_phys, qty_reserved: new_res, qty_available: new_avail, qty_backordered: new_back, qty_incoming: new_inc, last_move_id: move.id, updated_at: new Date() },
        create: { node_id, sku_id, qty_physical: new_phys, qty_reserved: new_res, qty_available: new_avail, qty_backordered: new_back, qty_incoming: new_inc, last_move_id: move.id },
      });
      // ─────────────────────────────────────────────────────────────────────

      // Emplacement de stockage (optionnel) : sku_node_locations.qty_physical, créé si absent.
      if (l.location_id) {
        const snl = await tx.skuNodeLocation.findUnique({
          where: { sku_id_node_id_location_id: { sku_id, node_id, location_id: l.location_id } },
        });
        if (snl) {
          await tx.skuNodeLocation.update({
            where: { id: snl.id },
            data: { qty_physical: q3(N(snl.qty_physical) + stockQty), is_active: true },
          });
        } else {
          const hasPrimary = await tx.skuNodeLocation.count({ where: { sku_id, node_id, is_primary_location: true, is_active: true } });
          await tx.skuNodeLocation.create({
            data: { sku_id, node_id, location_id: l.location_id, qty_physical: stockQty, is_primary_location: hasPrimary === 0, is_active: true },
          });
        }
      }

      // CUMP (US-047) : recalcul pondéré + snapshot si méthode CUMP (ou sans règle).
      const cost = await skuCost.recordReceiptCump(tx, {
        sku_id, node_id, qty_before: old_phys, qty_received: stockQty, cost_unit: costUnit, move_id: move.id, lot_id: lot.id,
      });

      const newReceived = q3(N(item.qty_received) + l.qty);
      await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { qty_received: newReceived } });
      item.qty_received = newReceived;

      created.push({
        item_id: item.id, sku_code: item.sku.sku_code, qty_received: l.qty, stock_qty: stockQty,
        lot_id: lot.id, move_id: move.id, lot_number: l.lot_number, expiry_date: fmtDate(l.expiry_date), cost_unit: costUnit,
        location_id: l.location_id, costing_method: cost.method, cump_before: cost.cump_before, cump: cost.cump, cost_snapshot_id: cost.snapshot_id,
      });
    }

    const complete = po.items.every((i) => N(i.qty_received) >= N(i.qty_ordered));
    const to = complete ? 'received' : 'partially_received';
    await tx.purchaseOrder.update({
      where: { id },
      data: { status_id: (await statusByCode(to, tx)).id, received_at: receptionDate },
    });
    return { from, to, reference: po.reference, lines: created };
  }, { timeout: 30000 });

  await audit(req, {
    action: 'RECEIVE',
    resource: 'purchase_orders',
    resource_id: id,
    old_values: { status: result.from },
    new_values: { status: result.to, lines: result.lines, notes },
  });
  const po = await getById(id);
  return { ...po, reception: result };
}

module.exports = { list, getById, create, update, changeStatus, remove, receive, nodeLocations };
