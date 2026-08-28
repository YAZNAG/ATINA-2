const prisma = require('../../../config/database');

const findByNode = (nodeId) =>
  prisma.deliverySlot.findMany({
    where: { node_id: nodeId },
    orderBy: [{ day_of_week: 'asc' }, { specific_date: 'asc' }, { slot_start: 'asc' }],
  });

// Créneaux récurrents (template hebdomadaire) d'un node
const findRecurringByNode = (nodeId) =>
  prisma.deliverySlot.findMany({
    where: { node_id: nodeId, specific_date: null },
    orderBy: [{ day_of_week: 'asc' }, { slot_start: 'asc' }],
  });

// Exceptions ponctuelles d'un node dans une plage de dates [start, end]
const findExceptionsByNodeAndRange = (nodeId, start, end) =>
  prisma.deliverySlot.findMany({
    where: {
      node_id: nodeId,
      specific_date: { gte: start, lte: end },
    },
    orderBy: [{ specific_date: 'asc' }, { slot_start: 'asc' }],
  });

const findById = (id) => prisma.deliverySlot.findUnique({ where: { id } });
const create = (data) => prisma.deliverySlot.create({ data });
const update = (id, data) => prisma.deliverySlot.update({ where: { id }, data });
const remove = (id) => prisma.deliverySlot.delete({ where: { id } });

module.exports = {
  findByNode,
  findRecurringByNode,
  findExceptionsByNodeAndRange,
  findById,
  create,
  update,
  remove,
};