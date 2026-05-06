const prisma = require('../../../config/database');

const INCLUDE = {
  sku: {
    include: {
      article: { select: { id: true, name_fr: true, name_ar: true, sku_code: true } },
    },
  },
  location: {
    include: { level: true, zone: true },
  },
  node: { select: { id: true, code: true, name_fr: true } },
};

const buildWhere = ({ search, node_id, zone_id, level_id, is_active, is_primary_location } = {}) => ({
  ...(node_id && { node_id }),
  ...(is_active !== undefined && { is_active: is_active === 'true' || is_active === true }),
  ...(is_primary_location !== undefined && { is_primary_location: is_primary_location === 'true' || is_primary_location === true }),
  ...(zone_id && { location: { zone_id } }),
  ...(level_id && { location: { level_id } }),
  ...(search && {
    OR: [
      { sku: { article: { name_fr: { contains: search, mode: 'insensitive' } } } },
      { sku: { article: { sku_code: { contains: search, mode: 'insensitive' } } } },
      { location: { label: { contains: search, mode: 'insensitive' } } },
    ],
  }),
});

const findAll = async ({ page = 1, limit = 20, all, ...filters } = {}) => {
  const where = buildWhere(filters);
  if (all === 'true' || all === true) {
    const data = await prisma.skuNodeLocation.findMany({ where, include: INCLUDE, orderBy: [{ updated_at: 'desc' }] });
    return { data, total: data.length };
  }
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const [data, total] = await Promise.all([
    prisma.skuNodeLocation.findMany({ where, skip: (pageNum - 1) * limitNum, take: limitNum, include: INCLUDE, orderBy: [{ updated_at: 'desc' }] }),
    prisma.skuNodeLocation.count({ where }),
  ]);
  return { data, total };
};

const findById = (id) => prisma.skuNodeLocation.findUnique({ where: { id }, include: INCLUDE });
const findDuplicate = (sku_id, node_id, location_id, excludeId) =>
  prisma.skuNodeLocation.findFirst({
    where: { sku_id, node_id, location_id, ...(excludeId && { NOT: { id: excludeId } }) },
  });
const findPrimary = (sku_id, node_id, excludeId) =>
  prisma.skuNodeLocation.findFirst({
    where: { sku_id, node_id, is_primary_location: true, ...(excludeId && { NOT: { id: excludeId } }) },
  });
const create = (data) => prisma.skuNodeLocation.create({ data, include: INCLUDE });
const update = (id, data) => prisma.skuNodeLocation.update({ where: { id }, data, include: INCLUDE });
const clearPrimary = (sku_id, node_id, excludeId) =>
  prisma.skuNodeLocation.updateMany({
    where: { sku_id, node_id, is_primary_location: true, ...(excludeId && { NOT: { id: excludeId } }) },
    data: { is_primary_location: false },
  });
const remove = (id) => prisma.skuNodeLocation.delete({ where: { id } });

module.exports = { findAll, findById, findDuplicate, findPrimary, create, update, clearPrimary, remove };
