const prisma = require('../../../config/database');

const findByNode = (nodeId) =>
  prisma.deliverySlot.findMany({
    where: { node_id: nodeId },
    orderBy: [{ day_of_week: 'asc' }, { slot_start: 'asc' }],
  });

const findById = (id) => prisma.deliverySlot.findUnique({ where: { id } });
const create = (data) => prisma.deliverySlot.create({ data });
const update = (id, data) => prisma.deliverySlot.update({ where: { id }, data });
const remove = (id) => prisma.deliverySlot.delete({ where: { id } });

module.exports = { findByNode, findById, create, update, remove };
