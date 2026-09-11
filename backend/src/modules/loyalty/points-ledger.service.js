const { Prisma } = require('@prisma/client');
const prisma = require('../../config/database');
const { audit } = require('../../utils/audit');
const { parseLabel, recordPointsTxn, txnTypeLabel, loadTxnTypes } = require('./points-ledger.util');

/**
 * Livre des points (points_transactions) — WF#25 / WF#40, US-013 / US-014 / US-086.
 * Strictement en LECTURE (hors ajustement manuel). Pagination KEYSET sur
 * (created_at DESC, id DESC) — jamais d'OFFSET. Le solde d'un client est lu dans
 * customers.points_balance, jamais recalculé par SUM().
 *
 * Références lues dans les COLONNES (txn_type_id, points_rule_id, referral_id,
 * game_play_id, reason) et leurs relations Prisma ; les balises du libellé
 * (parseLabel) ne servent qu'aux anciennes lignes dont les colonnes sont vides.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPORT_MAX = 20000;
const bad = (message) => ({ statusCode: 400, message });

function uuidOrThrow(v, label) {
  const s = String(v).trim();
  if (!UUID_RE.test(s)) throw bad(`${label} invalide.`);
  return s;
}

function parseDay(v, label, endOfDay = false) {
  if (!v) return null;
  const s = String(v).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(s);
  if (Number.isNaN(d.getTime())) throw bad(`${label} invalide.`);
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(s)) d.setDate(d.getDate() + 1);
  return d;
}

/** Conditions SQL communes à la liste, à l'export et au grand-livre d'un client. */
function buildConditions(query = {}, fixedCustomerId = null) {
  const conds = [];
  const customerId = fixedCustomerId || query.customer_id;
  if (customerId) conds.push(Prisma.sql`t.customer_id = ${uuidOrThrow(customerId, 'Client')}::uuid`);
  if (!fixedCustomerId && query.customer_search && String(query.customer_search).trim()) {
    const like = `%${String(query.customer_search).trim()}%`;
    conds.push(Prisma.sql`t.customer_id IN (SELECT c.id FROM customers c WHERE c.name ILIKE ${like} OR c.phone_number ILIKE ${like})`);
  }
  if (query.type) {
    // Code de points_txn_types ; les anciennes lignes sans txn_type_id sont filtrées sur la colonne texte.
    const code = String(query.type).trim();
    conds.push(Prisma.sql`(t.txn_type_id IN (SELECT ty.id FROM points_txn_types ty WHERE ty.code = ${code})
      OR (t.txn_type_id IS NULL AND t.type = ${code}))`);
  }
  if (query.direction === 'in') conds.push(Prisma.sql`t.points > 0`);
  if (query.direction === 'out') conds.push(Prisma.sql`t.points < 0`);
  // Références : colonne, avec repli sur la balise du libellé pour les anciennes lignes.
  const refCond = (col, tag, raw, label) => {
    const id = uuidOrThrow(raw, label);
    const c = Prisma.raw(`t.${col}`);
    return Prisma.sql`(${c} = ${id}::uuid OR (${c} IS NULL AND t.label ILIKE ${`%[${tag}:${id}]%`}))`;
  };
  const ruleId = query.points_rule_id || query.rule_id;
  if (ruleId) conds.push(refCond('points_rule_id', 'rule', ruleId, 'Règle'));
  if (query.referral_id) conds.push(refCond('referral_id', 'ref', query.referral_id, 'Parrainage'));
  if (query.game_play_id) conds.push(refCond('game_play_id', 'play', query.game_play_id, 'Partie de jeu'));
  if (query.order_id) conds.push(Prisma.sql`t.order_id = ${uuidOrThrow(query.order_id, 'Commande')}::uuid`);
  const from = parseDay(query.date_from, 'Date de début');
  const to = parseDay(query.date_to, 'Date de fin', true);
  if (from) conds.push(Prisma.sql`t.created_at >= ${from}`);
  if (to) conds.push(Prisma.sql`t.created_at < ${to}`);
  return conds;
}

async function pageIds(conds, cursor, take) {
  const all = [...conds];
  if (cursor) {
    const c = uuidOrThrow(cursor, 'Curseur');
    all.push(Prisma.sql`(t.created_at, t.id) < (SELECT p.created_at, p.id FROM points_transactions p WHERE p.id = ${c}::uuid)`);
  }
  const where = all.length ? Prisma.sql`WHERE ${Prisma.join(all, ' AND ')}` : Prisma.empty;
  const rows = await prisma.$queryRaw`
    SELECT t.id FROM points_transactions t
    ${where}
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT ${take}`;
  return rows.map((r) => r.id);
}

const RULE_SELECT = {
  id: true, points_value: true, per_mad_spent: true, is_deleted: true, is_active: true,
  rule_type: { select: { code: true, name_fr: true } }, category: { select: { name_fr: true } },
};
const REFERRAL_SELECT = {
  id: true, created_at: true,
  referrer: { select: { id: true, name: true } },
  referee: { select: { id: true, name: true } },
  status: { select: { code: true, name_fr: true } },
};
const PLAY_SELECT = { id: true, played_at: true, result: true, game: { select: { id: true, name_fr: true } } };

/**
 * Charge les lignes + les objets référencés (règle — même soft-deletée —, parrainage,
 * partie de jeu) par les relations Prisma des colonnes. Repli : balises du libellé
 * pour les anciennes lignes sans colonnes.
 */
async function hydrate(ids) {
  if (!ids.length) return [];
  const rows = await prisma.pointsTransaction.findMany({
    where: { id: { in: ids } },
    include: {
      customer: { select: { id: true, name: true, phone_country: true, phone_number: true } },
      order: { select: { id: true, created_at: true, total_ttc: true } },
      txn_type: { select: { code: true, name_fr: true, name_ar: true } },
      points_rule: { select: RULE_SELECT },
      referral: { select: REFERRAL_SELECT },
      game_play: { select: PLAY_SELECT },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const parsed = ids.map((id) => byId.get(id)).filter(Boolean).map((r) => {
    const legacy = parseLabel(r.label);
    return {
      row: r,
      refs: {
        reason: r.reason ?? legacy.reason,
        points_rule_id: r.points_rule_id ?? legacy.points_rule_id,
        referral_id: r.referral_id ?? legacy.referral_id,
        game_play_id: r.game_play_id ?? legacy.game_play_id,
      },
    };
  });

  // Repli : références trouvées seulement dans le libellé (anciennes lignes).
  const missing = (key) => [...new Set(parsed.filter((p) => !p.row[key] && p.refs[key]).map((p) => p.refs[key]))];
  const ruleIds = missing('points_rule_id');
  const refIds = missing('referral_id');
  const playIds = missing('game_play_id');
  const [rules, referrals, plays] = await Promise.all([
    ruleIds.length ? prisma.pointsRule.findMany({ where: { id: { in: ruleIds } }, select: RULE_SELECT }) : [],
    refIds.length ? prisma.referral.findMany({ where: { id: { in: refIds } }, select: REFERRAL_SELECT }) : [],
    playIds.length ? prisma.gamificationPlay.findMany({ where: { id: { in: playIds } }, select: PLAY_SELECT }).catch(() => []) : [],
  ]);
  const ruleMap = new Map(rules.map((r) => [r.id, r]));
  const refMap = new Map(referrals.map((r) => [r.id, r]));
  const playMap = new Map(plays.map((p) => [p.id, p]));

  return parsed.map(({ row, refs }) => {
    const rule = row.points_rule ?? (refs.points_rule_id ? ruleMap.get(refs.points_rule_id) : null);
    const referral = row.referral ?? (refs.referral_id ? refMap.get(refs.referral_id) ?? null : null);
    const gamePlay = row.game_play ?? (refs.game_play_id ? playMap.get(refs.game_play_id) ?? null : null);
    let source = null;
    if (row.order_id) source = { kind: 'order', id: row.order_id, label: `Commande #${row.order_id.slice(0, 8).toUpperCase()}` };
    else if (refs.referral_id) source = { kind: 'referral', id: refs.referral_id, label: 'Parrainage' };
    else if (refs.game_play_id) source = { kind: 'game_play', id: refs.game_play_id, label: 'Partie de jeu' };
    return {
      id: row.id,
      created_at: row.created_at,
      customer_id: row.customer_id,
      customer: row.customer,
      type: row.txn_type?.code ?? row.type,
      type_label: row.txn_type?.name_fr ?? txnTypeLabel(row.type),
      type_label_ar: row.txn_type?.name_ar ?? null,
      amount: row.points,
      direction: row.points >= 0 ? 'in' : 'out',
      reason: refs.reason,
      order_id: row.order_id,
      order: row.order,
      points_rule_id: refs.points_rule_id,
      rule: rule ? {
        id: rule.id,
        type_code: rule.rule_type?.code,
        type_label: rule.rule_type?.name_fr,
        category: rule.category?.name_fr ?? null,
        points_value: rule.points_value,
        per_mad_spent: rule.per_mad_spent != null ? Number(rule.per_mad_spent) : null,
        is_deleted: rule.is_deleted,
        is_active: rule.is_active,
      } : null,
      referral_id: refs.referral_id,
      referral,
      game_play_id: refs.game_play_id,
      game_play: gamePlay,
      source,
    };
  });
}

class PointsLedgerService {
  /** Types de transaction : référentiel points_txn_types (libellés FR/AR). */
  txnTypes() {
    return loadTxnTypes(prisma);
  }

  async list(query = {}, fixedCustomerId = null) {
    const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 25));
    const conds = buildConditions(query, fixedCustomerId);
    const ids = await pageIds(conds, query.cursor || null, limit + 1);
    const hasMore = ids.length > limit;
    const pageIdsList = hasMore ? ids.slice(0, limit) : ids;
    const items = await hydrate(pageIdsList);
    return {
      items,
      next_cursor: hasMore ? pageIdsList[pageIdsList.length - 1] : null,
      has_more: hasMore,
      limit,
    };
  }

  /** Export : même périmètre que la liste filtrée, parcouru par keyset (plafond EXPORT_MAX lignes). */
  async exportRows(query = {}, fixedCustomerId = null) {
    const conds = buildConditions(query, fixedCustomerId);
    const out = [];
    let cursor = null;
    while (out.length < EXPORT_MAX) {
      // eslint-disable-next-line no-await-in-loop
      const ids = await pageIds(conds, cursor, Math.min(1000, EXPORT_MAX - out.length));
      if (!ids.length) break;
      // eslint-disable-next-line no-await-in-loop
      out.push(...(await hydrate(ids)));
      cursor = ids[ids.length - 1];
      if (ids.length < 1000) break;
    }
    return { items: out, truncated: out.length >= EXPORT_MAX, max: EXPORT_MAX };
  }

  async detail(id) {
    const txnId = uuidOrThrow(id, 'Transaction');
    const [item] = await hydrate([txnId]);
    if (!item) throw { statusCode: 404, message: 'Transaction de points introuvable.' };
    const customer = await prisma.customer.findUnique({
      where: { id: item.customer_id },
      select: { id: true, name: true, phone_country: true, phone_number: true, points_balance: true, points_lifetime: true },
    });
    let order = null;
    if (item.order_id) {
      order = await prisma.order.findUnique({
        where: { id: item.order_id },
        select: {
          id: true, created_at: true, total_ttc: true,
          status: { select: { code: true, name_fr: true } },
          node: { select: { id: true, code: true, name_fr: true } },
        },
      }).catch(() => null);
    }
    let rule = null;
    if (item.points_rule_id) {
      rule = await prisma.pointsRule.findUnique({
        where: { id: item.points_rule_id },
        include: { rule_type: { select: { code: true, name_fr: true } }, category: { select: { id: true, name_fr: true } } },
      });
      if (rule) {
        rule = {
          ...rule,
          per_mad_spent: rule.per_mad_spent != null ? Number(rule.per_mad_spent) : null,
          min_order_amount: Number(rule.min_order_amount ?? 0),
        };
      }
    }
    return { ...item, customer, order: order ?? item.order, rule };
  }

  /** En-tête du grand-livre d'un client : valeurs LUES dans customers (jamais de SUM). */
  async customerHeader(customerId) {
    const c = await prisma.customer.findUnique({
      where: { id: uuidOrThrow(customerId, 'Client') },
      select: { id: true, name: true, points_balance: true, points_lifetime: true, is_deleted: true },
    });
    if (!c) throw { statusCode: 404, message: 'Client introuvable.' };
    return c;
  }

  /**
   * Ajustement manuel (WF#25 B / US-013) : 1 INSERT manual_adjustment + mise à jour
   * de customers.points_balance (et points_lifetime si crédit) dans UNE transaction.
   */
  async adjust(req, customerId, body = {}) {
    const id = uuidOrThrow(customerId, 'Client');
    const raw = body.amount ?? body.points;
    const amount = Number(raw);
    if (raw === undefined || raw === null || raw === '' || !Number.isFinite(amount)) throw bad('Le nombre de points est obligatoire.');
    if (!Number.isInteger(amount)) throw bad('Le nombre de points doit être un entier.');
    if (amount === 0) throw bad('Le nombre de points doit être différent de 0.');
    const reason = String(body.reason ?? body.label ?? '').trim();
    if (!reason) throw bad('Le motif de l’ajustement est obligatoire.');
    if (reason.length > 200) throw bad('Le motif ne peut pas dépasser 200 caractères.');

    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, is_deleted: true, points_balance: true, points_lifetime: true },
    });
    if (!customer || customer.is_deleted) throw { statusCode: 404, message: 'Client introuvable.' };

    return prisma.$transaction(async (tx) => {
      const res = await recordPointsTxn(tx, { customer_id: id, amount, type: 'manual_adjustment', reason });
      await audit(req, {
        action: 'UPDATE',
        resource: 'customers',
        resource_id: id,
        old_values: { points_balance: customer.points_balance, points_lifetime: customer.points_lifetime },
        new_values: {
          points_balance: res.points_balance,
          points_lifetime: res.points_lifetime,
          points_txn_id: res.txn.id,
          txn_type: 'manual_adjustment',
          amount,
          reason,
        },
      }, tx);
      return {
        points_balance: res.points_balance,
        points_lifetime: res.points_lifetime,
        transaction: { id: res.txn.id, amount, type: 'manual_adjustment', reason, created_at: res.txn.created_at },
      };
    });
  }
}

module.exports = new PointsLedgerService();
