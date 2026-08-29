const prisma = require('../../../config/database');

const buildWhere = ({ node_id, is_active, date, start_date, end_date } = {}) => {
  const w = {};
  if (node_id) w.node_id = node_id;
  if (is_active !== undefined && is_active !== '') w.is_active = is_active === 'true' || is_active === true;

  if (date) {
    w.specific_date = new Date(`${date}T00:00:00.000Z`);
  } else if (start_date || end_date) {
    w.specific_date = {};
    if (start_date) w.specific_date.gte = new Date(`${start_date}T00:00:00.000Z`);
    if (end_date)   w.specific_date.lte = new Date(`${end_date}T00:00:00.000Z`);
  }

  return w;
};

const findAll = async ({ page = 1, limit = 100, all, ...filters } = {}) => {
  const where = buildWhere(filters);
  if (all === 'true' || all === true) {
    const data = await prisma.deliverySlot.findMany({ where, orderBy: [{ specific_date: 'asc' }, { slot_start: 'asc' }], include: { node: { select: { id: true, name_fr: true, code: true } } } });
    return { data, total: data.length };
  }
  const [data, total] = await Promise.all([
    prisma.deliverySlot.findMany({ where, skip: (Number(page) - 1) * Number(limit), take: Number(limit), orderBy: [{ specific_date: 'asc' }, { slot_start: 'asc' }], include: { node: { select: { id: true, name_fr: true, code: true } } } }),
    prisma.deliverySlot.count({ where }),
  ]);
  return { data, total };
};

const findById  = (id) => prisma.deliverySlot.findUnique({ where: { id }, include: { node: { select: { id: true, name_fr: true, code: true } } } });
const create    = (data) => prisma.deliverySlot.create({ data });
const update    = (id, data) => prisma.deliverySlot.update({ where: { id }, data });
const remove    = (id) => prisma.deliverySlot.delete({ where: { id } });
const countUsage = (id) => prisma.order.count({ where: { confirmed_slot_id: id } });

module.exports = { findAll, findById, create, update, remove, countUsage };