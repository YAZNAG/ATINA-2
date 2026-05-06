const prisma = require('../../../config/database');

const INCLUDE = {
  level: true,
  zone: true,
  node: { select: { id: true, code: true, name_fr: true } },
  _count: { select: { sku_node_locations: { where: { is_active: true } } } },
};

const buildWhere = ({ search, node_id, zone_id, level_id, is_active } = {}) => ({
  is_deleted: false,
  ...(node_id && { node_id }),
  ...(zone_id && { zone_id }),
  ...(level_id && { level_id }),
  ...(is_active !== undefined && { is_active: is_active === 'true' || is_active === true }),
  ...(search && {
    OR: [
      { label: { contains: search, mode: 'insensitive' } },
      { aisle: { contains: search, mode: 'insensitive' } },
      { shelf: { contains: search, mode: 'insensitive' } },
    ],
  }),
});

const findAll = async ({ page = 1, limit = 20, all, ...filters } = {}) => {
  const where = buildWhere(filters);
  if (all === 'true' || all === true) {
    const data = await prisma.warehouseLocation.findMany({ where, include: INCLUDE, orderBy: [{ aisle: 'asc' }, { shelf: 'asc' }] });
    return { data, total: data.length };
  }
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const [data, total] = await Promise.all([
    prisma.warehouseLocation.findMany({ where, skip: (pageNum - 1) * limitNum, take: limitNum, include: INCLUDE, orderBy: [{ aisle: 'asc' }, { shelf: 'asc' }] }),
    prisma.warehouseLocation.count({ where }),
  ]);
  return { data, total };
};

const findById = (id) => prisma.warehouseLocation.findFirst({ where: { id, is_deleted: false }, include: INCLUDE });

const findDuplicate = (node_id, aisle, shelf, level_id, excludeId) =>
  prisma.warehouseLocation.findFirst({
    where: { node_id, aisle, shelf, level_id, is_deleted: false, ...(excludeId && { NOT: { id: excludeId } }) },
  });

const create = (data) => prisma.warehouseLocation.create({ data, include: INCLUDE });
const update = (id, data) => prisma.warehouseLocation.update({ where: { id }, data, include: INCLUDE });
const softDelete = (id) =>
  prisma.warehouseLocation.update({ where: { id }, data: { is_deleted: true, is_active: false, deleted_at: new Date() } });

module.exports = { findAll, findById, findDuplicate, create, update, softDelete };
