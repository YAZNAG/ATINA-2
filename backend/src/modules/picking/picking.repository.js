const prisma = require('../../config/database');

// Statuts de session considérés « en cours » (supervision) vs « clôturés » (historique).
const ACTIVE_CODES  = ['open', 'in_progress'];
const CLOSED_CODES  = ['completed', 'cancelled'];

const SKU_SELECT = { id: true, sku_code: true, name_fr: true, name_ar: true, ean13: true };

const SESSION_INCLUDE = {
  order:  {
    select: {
      id: true, total_ttc: true, created_at: true,
      status:   { select: { code: true, name_fr: true } },
      customer: { select: { name: true, phone_number: true, phone_country: true } },
    },
  },
  node:   { select: { id: true, code: true, name_fr: true } },
  picker: { select: { id: true, name: true, phone_number: true, phone_country: true, is_active: true } },
  status: { select: { id: true, code: true, name_fr: true, name_ar: true } },
  _count: { select: { items: true, quality_checks: true } },
};

const DETAIL_INCLUDE = {
  ...SESSION_INCLUDE,
  items: {
    include: {
      order_item: {
        select: {
          id: true, qty: true, unit_price_sold: true, sku_id: true, parent_item_id: true,
          sku: { select: SKU_SELECT },
          // Composant d'un pack : pack de la ligne d'en-tête (affichage « Pack : … »)
          parent_item: { select: { id: true, qty: true, pack: { select: { id: true, name_fr: true } } } },
        },
      },
      status:   { select: { id: true, code: true, name_fr: true, name_ar: true } },
      substitute_sku: { select: SKU_SELECT },
      location: {
        select: {
          id:    true,
          label: true,
          aisle: true,
          shelf: true,
          zone:  { select: { code: true, name_fr: true } },
          level: { select: { code: true, name_fr: true } },
        },
      },
    },
    orderBy: { order_item: { unit_price_sold: 'desc' } },
  },
  quality_checks: {
    select: {
      id: true, result: true, score: true, created_at: true,
      check_type: { select: { code: true, name_fr: true } },
    },
    orderBy: { created_at: 'desc' },
  },
};

// ── Filtres ──────────────────────────────────────────────────────────────────
const parseCodes = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

/**
 * Filtres acceptés : node_id, picker_id, order_id, status_code (liste « a,b »),
 * scope ('active' = open/in_progress, 'history' = completed/cancelled),
 * date_from / date_to (sur created_at, ou completed_at pour l'historique),
 * unassigned=true (sessions sans picker).
 */
const buildSessionWhere = ({ node_id, picker_id, status_code, order_id, scope, date_from, date_to, unassigned } = {}) => {
  const w = {};
  if (node_id)   w.node_id   = node_id;
  if (picker_id) w.picker_id = picker_id;
  if (order_id)  w.order_id  = order_id;
  if (unassigned === 'true' || unassigned === true) w.picker_id = null;

  let codes = parseCodes(status_code);
  if (scope === 'active')  codes = codes.length ? codes.filter((c) => ACTIVE_CODES.includes(c)) : ACTIVE_CODES;
  if (scope === 'history') codes = codes.length ? codes.filter((c) => CLOSED_CODES.includes(c)) : CLOSED_CODES;
  if (scope && codes.length === 0) codes = ['__none__'];
  if (codes.length === 1) w.status = { code: codes[0] };
  else if (codes.length > 1) w.status = { code: { in: codes } };

  if (date_from || date_to) {
    const field = scope === 'history' ? 'completed_at' : 'created_at';
    const f = {};
    if (date_from) { const d = new Date(date_from); if (!Number.isNaN(d.getTime())) f.gte = d; }
    if (date_to)   { const d = new Date(date_to);   if (!Number.isNaN(d.getTime())) f.lte = endOfDay(d); }
    if (Object.keys(f).length) {
      // Historique : une session annulée n'a pas de completed_at → on retombe sur created_at.
      if (field === 'completed_at') w.OR = [{ completed_at: f }, { completed_at: null, created_at: f }];
      else w.created_at = f;
    }
  }
  return w;
};

const findAllSessions = async ({ page = 1, limit = 25, scope, ...filters } = {}) => {
  const where = buildSessionWhere({ ...filters, scope });
  const orderBy = scope === 'history' ? [{ completed_at: 'desc' }, { created_at: 'desc' }] : { created_at: 'desc' };
  const [data, total] = await Promise.all([
    prisma.pickingSession.findMany({ where, include: SESSION_INCLUDE, orderBy, skip: (page - 1) * limit, take: limit }),
    prisma.pickingSession.count({ where }),
  ]);
  return { data, total };
};

/** Agrégats par session : lignes, lignes traitées, quantités attendues/prélevées. */
const aggregateItems = async (sessionIds) => {
  if (!sessionIds.length) return { totals: {}, processed: {} };
  const [totalsRows, processedRows] = await Promise.all([
    prisma.pickingSessionItem.groupBy({
      by: ['session_id'],
      where: { session_id: { in: sessionIds } },
      _count: { _all: true },
      _sum: { qty_expected: true, qty_picked: true },
    }),
    prisma.pickingSessionItem.groupBy({
      by: ['session_id'],
      where: { session_id: { in: sessionIds }, status: { code: { not: 'pending' } } },
      _count: { _all: true },
    }),
  ]);
  const totals = Object.fromEntries(totalsRows.map((r) => [r.session_id, r]));
  const processed = Object.fromEntries(processedRows.map((r) => [r.session_id, r._count._all]));
  return { totals, processed };
};

const countByStatus = async (filters = {}) => {
  const where = buildSessionWhere(filters);
  const rows = await prisma.pickingSession.groupBy({ by: ['status_id'], where, _count: { _all: true } });
  const statuses = await prisma.pickingStatus.findMany({ select: { id: true, code: true } });
  const byId = Object.fromEntries(statuses.map((s) => [s.id, s.code]));
  const out = {};
  for (const r of rows) out[byId[r.status_id] ?? r.status_id] = r._count._all;
  return out;
};

const findSessionById = (id) =>
  prisma.pickingSession.findUnique({ where: { id }, include: DETAIL_INCLUDE });

const findSessionByOrder = (order_id) =>
  prisma.pickingSession.findFirst({ where: { order_id }, include: DETAIL_INCLUDE, orderBy: { created_at: 'desc' } });

const createSession = (data) =>
  prisma.pickingSession.create({ data, include: SESSION_INCLUDE });

const updateSession = (id, data) =>
  prisma.pickingSession.update({ where: { id }, data, include: SESSION_INCLUDE });

/** Emplacements SKU×node (sku_node_locations), emplacement principal en premier. */
const findSkuNodeLocations = (node_id, sku_ids) => {
  if (!sku_ids.length) return Promise.resolve([]);
  return prisma.skuNodeLocation.findMany({
    where: { node_id, sku_id: { in: sku_ids }, is_active: true },
    select: {
      sku_id: true, is_primary_location: true, qty_physical: true,
      location: {
        select: {
          id: true, label: true, aisle: true, shelf: true,
          zone:  { select: { code: true, name_fr: true } },
          level: { select: { code: true, name_fr: true } },
        },
      },
    },
    orderBy: [{ is_primary_location: 'desc' }, { qty_physical: 'desc' }],
  });
};

// ── Items ─────────────────────────────────────────────────────────────────────
const findItemById = (id) =>
  prisma.pickingSessionItem.findUnique({
    where: { id },
    include: {
      session: { select: { id: true, order_id: true, status: { select: { code: true } } } },
      order_item: { select: { id: true, sku: { select: { ean13: true, sku_code: true } } } },
      status: { select: { code: true, name_fr: true } },
    },
  });

const updateItem = (id, data) =>
  prisma.pickingSessionItem.update({ where: { id }, data });

// ── Lookups ───────────────────────────────────────────────────────────────────
const getPickingStatusByCode   = (code) => prisma.pickingStatus.findFirst({ where: { code } });
const getPickItemStatusByCode  = (code) => prisma.pickItemStatus.findFirst({ where: { code } });
const getFirstPickerForNode    = (node_id) => prisma.picker.findFirst({ where: { node_id, is_active: true, is_deleted: false } });
const getAllPickers             = (node_id) => prisma.picker.findMany({
  where: { ...(node_id && { node_id }), is_active: true, is_deleted: false },
  select: { id: true, name: true, phone_number: true, node_id: true, node: { select: { code: true } } },
  orderBy: { name: 'asc' },
});
const getOrderStatusByCode     = (code) => prisma.orderStatus.findFirst({ where: { code } });
const getOrderItemStatusByCode = (code) => prisma.orderItemStatus.findFirst({ where: { code } });

module.exports = {
  ACTIVE_CODES, CLOSED_CODES,
  buildSessionWhere, findAllSessions, aggregateItems, countByStatus,
  findSessionById, findSessionByOrder, createSession, updateSession, findSkuNodeLocations,
  findItemById, updateItem,
  getPickingStatusByCode, getPickItemStatusByCode, getFirstPickerForNode, getAllPickers,
  getOrderStatusByCode, getOrderItemStatusByCode,
};
