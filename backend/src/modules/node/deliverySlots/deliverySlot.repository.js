const prisma = require('../../../config/database');

const findByNodeAndDate = (nodeId, date) =>
  prisma.deliverySlot.findMany({
    where: { node_id: nodeId, specific_date: date },
    orderBy: { slot_start: 'asc' },
    include: { _count: { select: { orders_confirmed: true } } },
  });

// Aperçu calendrier : créneaux du mois avec horaires + statut actif/inactif
const findMonthOverview = (nodeId, start, end) =>
  prisma.deliverySlot.findMany({
    where: { node_id: nodeId, specific_date: { gte: start, lte: end } },
    select: { specific_date: true, slot_start: true, slot_end: true, is_active: true },
    orderBy: { slot_start: 'asc' },
  });

const findById = (id) => prisma.deliverySlot.findUnique({ where: { id } });
const create = (data) => prisma.deliverySlot.create({ data });
const update = (id, data) => prisma.deliverySlot.update({ where: { id }, data });
const remove = (id) => prisma.deliverySlot.delete({ where: { id } });

module.exports = { findByNodeAndDate, findMonthOverview, findById, create, update, remove };