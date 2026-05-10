const prisma = require('../../../config/database');

const DAY_LABELS = { 0: 'Dimanche', 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi' };

const buildWhere = ({ node_id, is_active } = {}) => {
  const w = {};
  if (node_id)              w.node_id  = node_id;
  if (is_active !== undefined && is_active !== '') w.is_active = is_active === 'true' || is_active === true;
  return w;
};

const findAll = async ({ page = 1, limit = 100, all, ...filters } = {}) => {
  const where = buildWhere(filters);
  if (all === 'true' || all === true) {
    const data = await prisma.deliverySlot.findMany({ where, orderBy: [{ day_of_week: 'asc' }, { slot_start: 'asc' }], include: { node: { select: { id: true, name_fr: true, code: true } } } });
    return { data, total: data.length };
  }
  const [data, total] = await Promise.all([
    prisma.deliverySlot.findMany({ where, skip: (Number(page) - 1) * Number(limit), take: Number(limit), orderBy: [{ day_of_week: 'asc' }, { slot_start: 'asc' }], include: { node: { select: { id: true, name_fr: true, code: true } } } }),
    prisma.deliverySlot.count({ where }),
  ]);
  return { data, total };
};

const findById  = (id) => prisma.deliverySlot.findUnique({ where: { id }, include: { node: { select: { id: true, name_fr: true, code: true } } } });
const create    = (data) => prisma.deliverySlot.create({ data });
const update    = (id, data) => prisma.deliverySlot.update({ where: { id }, data });
const remove    = (id) => prisma.deliverySlot.delete({ where: { id } });
const countUsage = (id) => prisma.order.count({ where: { confirmed_slot_id: id } });

module.exports = { findAll, findById, create, update, remove, countUsage, DAY_LABELS };
