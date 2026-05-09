const prisma = require('../../../config/database');
const { ensureNodeTypesPrismaColumns } = require('../../../utils/ensureNodeTypesDb');

const findAll = async () => {
  await ensureNodeTypesPrismaColumns(prisma);
  return prisma.nodeType.findMany({
    orderBy: [{ created_at: 'asc' }],
    include: { _count: { select: { nodes: true } } },
  });
};

const findAllActive = async () => {
  await ensureNodeTypesPrismaColumns(prisma);
  return prisma.nodeType.findMany({
    where: { is_active: true },
    orderBy: [{ name_fr: 'asc' }],
  });
};

const findById = async (id) => {
  await ensureNodeTypesPrismaColumns(prisma);
  return prisma.nodeType.findUnique({
    where: { id },
    include: { _count: { select: { nodes: true } } },
  });
};

const findByCode = async (code, excludeId) => {
  await ensureNodeTypesPrismaColumns(prisma);
  return prisma.nodeType.findFirst({
    where: { code, ...(excludeId && { NOT: { id: excludeId } }) },
  });
};

const create = async (data) => {
  await ensureNodeTypesPrismaColumns(prisma);
  return prisma.nodeType.create({ data });
};
const update = async (id, data) => {
  await ensureNodeTypesPrismaColumns(prisma);
  return prisma.nodeType.update({ where: { id }, data });
};
const remove = async (id) => {
  await ensureNodeTypesPrismaColumns(prisma);
  return prisma.nodeType.delete({ where: { id } });
};

module.exports = { findAll, findAllActive, findById, findByCode, create, update, remove };
