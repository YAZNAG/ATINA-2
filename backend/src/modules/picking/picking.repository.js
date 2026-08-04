const prisma = require('../../config/database');

const SESSION_INCLUDE = {
  order:  { select: { id: true, total_ttc: true, customer: { select: { name: true, phone_number: true, phone_country: true } } } },
  node:   { select: { id: true, code: true, name_fr: true } },
  picker: { select: { id: true, name: true, phone_number: true } },
  status: { select: { id: true, code: true, name_fr: true } },
  _count: { select: { items: true } },
};

const DETAIL_INCLUDE = {
  ...SESSION_INCLUDE,
  items: {
    include: {
      order_item: {
        select: {
          id: true, qty: true, unit_price_sold: true,
          sku: { select: { id: true, article: { select: { name_fr: true, ean13: true } } } },
        },
      },
      status:   { select: { id: true, code: true, name_fr: true } },
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
};

// ── Sessions ──────────────────────────────────────────────────────────────────
const buildSessionWhere = ({ node_id, picker_id, status_code, order_id } = {}) => {
  const w = {};
  if (node_id)     w.node_id   = node_id;
  if (picker_id)   w.picker_id = picker_id;
  if (order_id)    w.order_id  = order_id;
  if (status_code) w.status    = { code: status_code };
  return w;
};

const findAllSessions = async ({ page = 1, limit = 25, ...filters } = {}) => {
  const where = buildSessionWhere(filters);
  const [data, total] = await Promise.all([
    prisma.pickingSession.findMany({ where, include: SESSION_INCLUDE, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.pickingSession.count({ where }),
  ]);
  return { data, total };
};

const findSessionById = (id) =>
  prisma.pickingSession.findUnique({ where: { id }, include: DETAIL_INCLUDE });

const findSessionByOrder = (order_id) =>
  prisma.pickingSession.findFirst({ where: { order_id }, include: DETAIL_INCLUDE });

const createSession = (data) =>
  prisma.pickingSession.create({ data, include: SESSION_INCLUDE });

const updateSession = (id, data) =>
  prisma.pickingSession.update({ where: { id }, data, include: SESSION_INCLUDE });

// ── Items ─────────────────────────────────────────────────────────────────────
const findItemById = (id) =>
  prisma.pickingSessionItem.findUnique({
    where: { id },
    include: {
      session: { select: { id: true, status: { select: { code: true } } } },
      order_item: { select: { id: true, sku: { select: { article: { select: { ean13: true } } } } } },
      status: { select: { code: true, name_fr: true } },
    },
  });

const updateItem = (id, data) =>
  prisma.pickingSessionItem.update({ where: { id }, data });

// ── Lookups ───────────────────────────────────────────────────────────────────
const getPickingStatusByCode   = (code) => prisma.pickingStatus.findFirst({ where: { code } });
const getPickItemStatusByCode  = (code) => prisma.pickItemStatus.findFirst({ where: { code } });
const getFirstPickerForNode    = (node_id) => prisma.picker.findFirst({ where: { node_id, is_active: true, is_deleted: false } });
const getAllPickers             = (node_id) => prisma.picker.findMany({ where: { ...(node_id && { node_id }), is_active: true, is_deleted: false }, select: { id: true, name: true, phone_number: true, node: { select: { code: true } } } });
const getOrderStatusByCode     = (code) => prisma.orderStatus.findFirst({ where: { code } });
const getOrderItemStatusByCode = (code) => prisma.orderItemStatus.findFirst({ where: { code } });

module.exports = {
  findAllSessions, findSessionById, findSessionByOrder, createSession, updateSession,
  findItemById, updateItem,
  getPickingStatusByCode, getPickItemStatusByCode, getFirstPickerForNode, getAllPickers,
  getOrderStatusByCode, getOrderItemStatusByCode,
};
