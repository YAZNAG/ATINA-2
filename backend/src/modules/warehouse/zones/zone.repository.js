const prisma = require('../../../config/database');
const { ensureZonesLevelsTables } = require('../../../utils/ensureWarehouseZonesLevelsDb');

const buildWhere = ({ search, is_active } = {}) => ({
  ...(is_active !== undefined && { is_active: is_active === 'true' || is_active === true }),
  ...(search && {
    OR: [
      { code: { contains: search, mode: 'insensitive' } },
      { name_fr: { contains: search, mode: 'insensitive' } },
      { name_ar: { contains: search, mode: 'insensitive' } },
    ],
  }),
});

const findAll = async ({ page = 1, limit = 20, all, ...filters } = {}) => {
  await ensureZonesLevelsTables(prisma);
  const where = buildWhere(filters);
  if (all === 'true' || all === true) {
    const data = await prisma.zone.findMany({ where, orderBy: [{ name_fr: 'asc' }] });
    return { data, total: data.length };
  }
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const [data, total] = await Promise.all([
    prisma.zone.findMany({ where, skip: (pageNum - 1) * limitNum, take: limitNum, orderBy: [{ name_fr: 'asc' }] }),
    prisma.zone.count({ where }),
  ]);
  return { data, total };
};

const findById = async (id) => {
  await ensureZonesLevelsTables(prisma);
  return prisma.zone.findUnique({ where: { id } });
};
const findByCode = async (code, excludeId) => {
  await ensureZonesLevelsTables(prisma);
  return prisma.zone.findFirst({ where: { code, ...(excludeId && { NOT: { id: excludeId } }) } });
};
const create = async (data) => {
  await ensureZonesLevelsTables(prisma);
  return prisma.zone.create({ data });
};
const update = async (id, data) => {
  await ensureZonesLevelsTables(prisma);
  return prisma.zone.update({ where: { id }, data });
};
const remove = async (id) => {
  await ensureZonesLevelsTables(prisma);
  return prisma.zone.delete({ where: { id } });
};

module.exports = { findAll, findById, findByCode, create, update, remove };
