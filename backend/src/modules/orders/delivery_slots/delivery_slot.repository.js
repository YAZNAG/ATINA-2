const prisma = require('../../../config/database');

const buildWhere = ({ node_id, is_active, date, start_date, end_date, month } = {}) => {
  const w = {};
  if (node_id) w.node_id = node_id;
  if (is_active !== undefined && is_active !== '') w.is_active = is_active === 'true' || is_active === true;

  if (date) {
    w.specific_date = new Date(`${date}T00:00:00.000Z`);
  } else if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    w.specific_date = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
  } else if (start_date || end_date) {
    w.specific_date = {};
    if (start_date) w.specific_date.gte = new Date(`${start_date}T00:00:00.000Z`);
    if (end_date)   w.specific_date.lte = new Date(`${end_date}T00:00:00.000Z`);
  }
  return w;
};

const INCLUDE = { node: { select: { id: true, name_fr: true, code: true, slot_selection_enabled: true } } };
const ORDER_BY = [{ specific_date: 'asc' }, { slot_start: 'asc' }];

const findAll = async ({ page = 1, limit = 100, all, ...filters } = {}) => {
  const where = buildWhere(filters);
  if (all === 'true' || all === true) {
    const data = await prisma.deliverySlot.findMany({ where, orderBy: ORDER_BY, include: INCLUDE, take: 2000 });
    return { data, total: data.length };
  }
  const [data, total] = await Promise.all([
    prisma.deliverySlot.findMany({ where, skip: (Number(page) - 1) * Number(limit), take: Number(limit), orderBy: ORDER_BY, include: INCLUDE }),
    prisma.deliverySlot.count({ where }),
  ]);
  return { data, total };
};

const findById  = (id) => prisma.deliverySlot.findUnique({ where: { id }, include: INCLUDE });
const create    = (data, db = prisma) => db.deliverySlot.create({ data });
const update    = (id, data) => prisma.deliverySlot.update({ where: { id }, data });
// Aucune suppression physique d'un créneau : le retrait = is_active = false (voir service.delete).
const countUsage = async (id) => {
  const [orders, prefs] = await Promise.all([
    prisma.order.count({ where: { confirmed_slot_id: id } }),
    prisma.orderSlotPreference.count({ where: { slot_id: id } }),
  ]);
  return orders + prefs;
};

/** Doublon UNIQUE(node_id, slot_date, slot_start, slot_end) — contrôlé applicativement. */
const findDuplicate = (node_id, specific_date, slot_start, slot_end, excludeId = null, db = prisma) =>
  db.deliverySlot.findFirst({
    where: { node_id, specific_date, slot_start, slot_end, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });

const findPreferences = (slot_id) =>
  prisma.orderSlotPreference.findMany({
    where: { slot_id },
    include: {
      status: { select: { code: true, name_fr: true, color: true } },
      order: {
        select: {
          id: true, created_at: true, confirmed_slot_id: true,
          status: { select: { code: true, name_fr: true } },
          customer: { select: { id: true, name: true, phone_country: true, phone_number: true } },
        },
      },
    },
    orderBy: [{ preference_order: 'asc' }, { created_at: 'asc' }],
  });

const findConfirmedOrders = (slot_id) =>
  prisma.order.findMany({
    where: { confirmed_slot_id: slot_id, is_deleted: false, status: { code: { not: 'cancelled' } } },
    select: {
      id: true, created_at: true, total_ttc: true,
      status: { select: { code: true, name_fr: true } },
      customer: { select: { id: true, name: true, phone_country: true, phone_number: true } },
      assignment_source: { select: { code: true, name_fr: true } },
    },
    orderBy: { created_at: 'asc' },
  });

module.exports = { findAll, findById, create, update, countUsage, findDuplicate, findPreferences, findConfirmedOrders };
