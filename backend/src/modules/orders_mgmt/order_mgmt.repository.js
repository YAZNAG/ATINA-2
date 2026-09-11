const prisma = require('../../config/database');

// ── Shared includes ───────────────────────────────────────────────────────────
const PICKING_SESSION_SUMMARY = {
  where: { status: { code: { not: 'CANCELLED', mode: 'insensitive' } } },
  orderBy: { created_at: 'desc' },
  take: 1,
  select: {
    id: true,
    created_at: true,
    started_at: true,
    completed_at: true,
    picker: { select: { id: true, name: true, phone_number: true } },
    status: { select: { id: true, code: true, name_fr: true } },
    items: { select: { id: true, status: { select: { code: true, name_fr: true } } } },
  },
};

const PAYMENTS_INCLUDE = {
  include: {
    status:         { select: { code: true, name_fr: true } },
    payment_method: { select: { code: true, name_fr: true } },
  },
  orderBy: { created_at: 'desc' },
};

const LIST_INCLUDE = {
  customer:      { select: { id: true, name: true, phone_country: true, phone_number: true } },
  status:        { select: { id: true, code: true, name_fr: true, color: true, is_terminal: true, sort_order: true } },
  delivery_type: { select: { id: true, code: true, name_fr: true } },
  node:          { select: { id: true, code: true, name_fr: true } },
  // Lignes de premier niveau (produits seuls + en-têtes de pack)
  _count:        { select: { items: { where: { parent_item_id: null } }, slot_preferences: true } },
  picking_sessions: PICKING_SESSION_SUMMARY,
  confirmed_slot: {
    select: { id: true, specific_date: true, slot_start: true, slot_end: true, name_fr: true },
  },
  payments: PAYMENTS_INCLUDE,
};

const DETAIL_INCLUDE = {
  customer: { select: { id: true, name: true, phone_country: true, phone_number: true, wallet_balance: true, points_balance: true } },
  address:  { include: { city_ref: { select: { id: true, name_fr: true } } } },
  status:   true,
  delivery_type: true,
  node: {
    select: {
      id: true, code: true, name_fr: true, timezone: true,
      delivery_fee: true, min_order_amount: true, slot_selection_enabled: true,
    },
  },
  confirmed_slot: { select: { id: true, specific_date: true, slot_start: true, slot_end: true, max_orders: true, name_fr: true, name_ar: true } },
  assignment_source: { select: { id: true, code: true, name_fr: true } },
  promotion: { select: { id: true, code: true } },
  coupon_redemptions: { select: { id: true, discount_applied: true, redeemed_at: true } },
  tour: { select: { id: true, date: true, status: { select: { code: true, name_fr: true } }, driver: { select: { id: true, name: true } } } },
  items: {
    include: {
      status:     { select: { code: true, name_fr: true, color: true } },
      sku:        { select: { id: true, name_fr: true, sku_code: true, price: true } },
      pack:       { select: { id: true, name_fr: true } },
      flash_sale: { select: { id: true, name_fr: true } },
    },
    orderBy: { unit_price_sold: 'desc' },
  },
  slot_preferences: {
    include: {
      status: { select: { id: true, code: true, name_fr: true, color: true } },
      slot:   { select: { id: true, specific_date: true, slot_start: true, slot_end: true, max_orders: true, is_active: true, name_fr: true } },
    },
    orderBy: { preference_order: 'asc' },
  },
  payments: PAYMENTS_INCLUDE,
  picking_sessions: PICKING_SESSION_SUMMARY,
};

// ── Build WHERE clause ────────────────────────────────────────────────────────
function dayStart(date) { return new Date(`${date}T00:00:00.000Z`); }

/**
 * Période nommée (liens du reporting) → { gte, lt } sur created_at.
 * today|day, yesterday, week (semaine en cours, lundi), month (mois en cours),
 * year, 7d, 30d, 90d.
 */
function periodRange(period) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const p = String(period || '').toLowerCase();
  if (p === 'today' || p === 'day' || p === 'jour') return { gte: today, lt: tomorrow };
  if (p === 'yesterday') { const y = new Date(today); y.setUTCDate(y.getUTCDate() - 1); return { gte: y, lt: today }; }
  if (p === 'week' || p === 'semaine') {
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    return { gte: start, lt: tomorrow };
  }
  if (p === 'month' || p === 'mois') return { gte: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), lt: tomorrow };
  if (p === 'year' || p === 'annee') return { gte: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)), lt: tomorrow };
  const m = p.match(/^(\d{1,3})d$/);
  if (m) { const start = new Date(today); start.setUTCDate(start.getUTCDate() - Number(m[1]) + 1); return { gte: start, lt: tomorrow }; }
  return null;
}

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

function buildWhere({
  search,
  status_code,
  delivery_type_code,
  node_id,
  customer_id,
  date,
  date_from,
  date_to,
  slot_id,
  without_slot,
  payment_status,
  pack_id,
  flash_sale_id,
  promotion_id,
  period,
  from,
  to,
} = {}) {
  const where = { is_deleted: false };

  if (search?.trim()) {
    const s = search.trim();
    where.OR = [
      { id: { contains: s, mode: 'insensitive' } },
      { customer: { name: { contains: s, mode: 'insensitive' } } },
      { customer: { phone_number: { contains: s, mode: 'insensitive' } } },
    ];
    // Recherche par référence courte ORD-XXXXXXXX
    const ref = s.replace(/^ORD-/i, '').toLowerCase();
    if (ref && ref !== s.toLowerCase()) where.OR.push({ id: { startsWith: ref } });
  }

  if (status_code) {
    const codes = String(status_code).split(',').map((c) => c.trim()).filter(Boolean);
    where.status = codes.length > 1
      ? { OR: codes.map((c) => ({ code: { equals: c, mode: 'insensitive' } })) }
      : { code: { equals: codes[0], mode: 'insensitive' } };
  }
  if (delivery_type_code) where.delivery_type = { code: { equals: delivery_type_code, mode: 'insensitive' } };
  if (node_id) where.node_id = node_id;
  if (customer_id) where.customer_id = customer_id;

  // Alias venant du reporting : from / to (AAAA-MM-JJ) et period nommée.
  const dFrom = date_from || (isDate(from) ? from : null);
  const dTo = date_to || (isDate(to) ? to : null);
  if (!date && !dFrom && !dTo && period) {
    const r = periodRange(period);
    if (r) where.created_at = r;
  }

  if (date) {
    const start = dayStart(date);
    const end = dayStart(date);
    end.setUTCDate(end.getUTCDate() + 1);
    where.created_at = { gte: start, lt: end };
  } else if (dFrom || dTo) {
    where.created_at = {};
    if (dFrom) where.created_at.gte = dayStart(dFrom);
    if (dTo) {
      const end = dayStart(dTo);
      end.setUTCDate(end.getUTCDate() + 1);
      where.created_at.lt = end;
    }
  }

  if (slot_id) where.confirmed_slot_id = slot_id;
  else if (without_slot === 'true' || without_slot === true) where.confirmed_slot_id = null;

  if (payment_status) where.payments = { some: { status: { code: { equals: payment_status, mode: 'insensitive' } } } };

  // Liens depuis Offres (pack, vente flash, code promo)
  const itemFilters = [];
  if (pack_id) itemFilters.push({ items: { some: { pack_id } } });
  if (flash_sale_id) itemFilters.push({ items: { some: { flash_sale_id } } });
  if (itemFilters.length) where.AND = [...(where.AND || []), ...itemFilters];
  if (promotion_id) where.promotion_id = promotion_id;

  return where;
}

// ── Queries ───────────────────────────────────────────────────────────────────
const findAll = async ({ page = 1, limit = 25, ...filters } = {}) => {
  const where = buildWhere(filters);
  const [data, total] = await Promise.all([
    prisma.order.findMany({ where, include: LIST_INCLUDE, orderBy: { created_at: 'desc' }, skip: (Number(page) - 1) * Number(limit), take: Number(limit) }),
    prisma.order.count({ where }),
  ]);
  return { data, total };
};

const findById = (id) => prisma.order.findFirst({ where: { id, is_deleted: false }, include: DETAIL_INCLUDE });

const getStatusByCode = (code) => prisma.orderStatus.findFirst({ where: { code: { equals: code, mode: 'insensitive' } } });

const getHistory = (order_id) =>
  prisma.orderHistory.findMany({
    where:   { order_id },
    include: { status: { select: { id: true, code: true, name_fr: true, color: true } } },
    orderBy: { created_at: 'asc' },
  });

const addHistory = (order_id, status_id, changed_by = null, note = null) =>
  prisma.orderHistory.create({ data: { order_id, status_id, changed_by, note } });

const countByStatus = async () => {
  const rows = await prisma.orderStatus.findMany({
    select: {
      code: true,
      name_fr: true,
      color: true,
      sort_order: true,
      _count: { select: { orders: { where: { is_deleted: false } } } },
    },
    orderBy: { sort_order: 'asc' },
  });
  return rows.map((status) => ({
    code: status.code,
    name_fr: status.name_fr,
    color: status.color,
    count: status._count.orders,
  }));
};

const getNodes = () =>
  prisma.node.findMany({
    where: { is_active: true, is_deleted: false },
    select: {
      id: true, code: true, name_fr: true,
      delivery_fee: true, min_order_amount: true, slot_selection_enabled: true,
      city: { select: { id: true, name_fr: true } },
    },
    orderBy: { name_fr: 'asc' },
  });

const getDeliveryTypes = () =>
  prisma.deliveryType.findMany({ select: { id: true, code: true, name_fr: true }, orderBy: { code: 'asc' } });

const getPaymentStatuses = () =>
  prisma.paymentStatus.findMany({ select: { id: true, code: true, name_fr: true }, orderBy: { code: 'asc' } });

// Créneaux pour le filtre de la liste (datés : à venir par défaut).
const getSlots = ({ node_id, date } = {}) => {
  const where = {};
  if (node_id) where.node_id = node_id;
  if (date) {
    where.specific_date = new Date(`${date}T00:00:00.000Z`);
  } else {
    const today = new Date();
    where.specific_date = { gte: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) };
  }
  return prisma.deliverySlot.findMany({
    where,
    select: { id: true, node_id: true, specific_date: true, slot_start: true, slot_end: true, max_orders: true, is_active: true, name_fr: true },
    orderBy: [{ specific_date: 'asc' }, { slot_start: 'asc' }],
    take: 200,
  });
};

const getUsersByIds = async (ids) => {
  const clean = [...new Set((ids || []).filter((v) => Number.isInteger(v)))];
  if (!clean.length) return {};
  const users = await prisma.user.findMany({ where: { id: { in: clean } }, select: { id: true, full_name: true, email: true } });
  return Object.fromEntries(users.map((u) => [u.id, u]));
};

module.exports = {
  findAll, findById, getStatusByCode, getHistory, addHistory, countByStatus,
  getNodes, getDeliveryTypes, getPaymentStatuses, getSlots, getUsersByIds,
  DETAIL_INCLUDE, LIST_INCLUDE, buildWhere, periodRange,
};
