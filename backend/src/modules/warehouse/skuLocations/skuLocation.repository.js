const prisma = require('../../../config/database');

// NB : depuis la fusion Article -> Sku, le SKU porte directement ses libellés
// (plus de relation `article`).
const SKU_SELECT = {
  id: true,
  sku_code: true,
  ean13: true,
  name_fr: true,
  name_ar: true,
  is_active: true,
};

const INCLUDE = {
  sku: { select: SKU_SELECT },
  location: {
    include: { level: true, zone: true },
  },
  node: { select: { id: true, code: true, name_fr: true } },
};

const bool = (v) => v === 'true' || v === true;

const buildWhere = ({ search, node_id, sku_id, location_id, zone_id, level_id, is_active, is_primary_location } = {}) => {
  const locationWhere = {
    ...(zone_id && { zone_id: zone_id === 'none' ? null : zone_id }),
    ...(level_id && { level_id }),
  };
  return {
    location: { is_deleted: false, ...locationWhere },
    ...(node_id && { node_id }),
    ...(sku_id && { sku_id }),
    ...(location_id && { location_id }),
    ...(is_active !== undefined && is_active !== '' && { is_active: bool(is_active) }),
    ...(is_primary_location !== undefined && is_primary_location !== '' && { is_primary_location: bool(is_primary_location) }),
    ...(search && {
      OR: [
        { sku: { name_fr: { contains: search, mode: 'insensitive' } } },
        { sku: { name_ar: { contains: search, mode: 'insensitive' } } },
        { sku: { sku_code: { contains: search, mode: 'insensitive' } } },
        { sku: { ean13: { contains: search, mode: 'insensitive' } } },
        { location: { label: { contains: search, mode: 'insensitive' } } },
      ],
    }),
  };
};

const ORDER = [{ location: { label: 'asc' } }, { updated_at: 'desc' }];

const findAll = async ({ page = 1, limit = 20, all, ...filters } = {}) => {
  const where = buildWhere(filters);
  if (all === 'true' || all === true) {
    const data = await prisma.skuNodeLocation.findMany({ where, include: INCLUDE, orderBy: ORDER });
    return { data, total: data.length };
  }
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 20);
  const [data, total] = await Promise.all([
    prisma.skuNodeLocation.findMany({ where, skip: (pageNum - 1) * limitNum, take: limitNum, include: INCLUDE, orderBy: ORDER }),
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
// Ligne de mapping (table de liaison de configuration, sans historique métier) : retrait physique.
const remove = (id) => prisma.skuNodeLocation.delete({ where: { id } });

module.exports = { findAll, findById, findDuplicate, findPrimary, create, update, clearPrimary, remove };
