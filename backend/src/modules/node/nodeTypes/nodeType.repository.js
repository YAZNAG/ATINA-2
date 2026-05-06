const prisma = require('../../../config/database');

const findAll = () =>
  prisma.nodeType.findMany({
    orderBy: [{ created_at: 'asc' }],
    include: { _count: { select: { nodes: true } } },
  });

const findAllActive = () =>
  prisma.nodeType.findMany({
    where: { is_active: true },
    orderBy: [{ name_fr: 'asc' }],
  });

const findById = (id) =>
  prisma.nodeType.findUnique({
    where: { id },
    include: { _count: { select: { nodes: true } } },
  });

const findByCode = (code, excludeId) =>
  prisma.nodeType.findFirst({
    where: { code, ...(excludeId && { NOT: { id: excludeId } }) },
  });

const create = (data) => prisma.nodeType.create({ data });
const update = (id, data) => prisma.nodeType.update({ where: { id }, data });
const remove = (id) => prisma.nodeType.delete({ where: { id } });

module.exports = { findAll, findAllActive, findById, findByCode, create, update, remove };
