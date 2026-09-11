const prisma = require('../../../config/database');

const INCLUDE = {
  region: {
    select: { id: true, code: true, name_fr: true, name_ar: true },
  },
  _count: { select: { nodes: { where: { is_deleted: false } } } },
};

const bool = (v) => v === 'true' || v === true;

const buildWhere = ({ search, region_id, is_active, is_deleted }) => ({
  ...(is_deleted !== undefined && is_deleted !== '' && { is_deleted: bool(is_deleted) }),
  ...(region_id && { region_id }),
  ...(is_active !== undefined && is_active !== '' && { is_active: bool(is_active) }),
  ...(search && {
    OR: [
      { name_fr: { contains: search, mode: 'insensitive' } },
      { name_ar: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { postal_code: { contains: search, mode: 'insensitive' } },
    ],
  }),
});

const findAll = async ({ search, region_id, is_active, is_deleted, page = 1, limit = 20 }) => {
  const where = buildWhere({ search, region_id, is_active, is_deleted });
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 20);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.city.findMany({ where, skip, take: limitNum, include: INCLUDE, orderBy: [{ name_fr: 'asc' }] }),
    prisma.city.count({ where }),
  ]);
  return { data, total };
};

const findById = (id) => prisma.city.findFirst({ where: { id, is_deleted: false }, include: INCLUDE });
// Le code est UNIQUE en base (y compris sur les villes supprimées).
const findByCode = (code, excludeId) =>
  prisma.city.findFirst({ where: { code, ...(excludeId && { NOT: { id: excludeId } }) } });
const create = (data) => prisma.city.create({ data, include: INCLUDE });
const update = (id, data) => prisma.city.update({ where: { id }, data, include: INCLUDE });
const countNodes = (cityId) => prisma.node.count({ where: { city_id: cityId, is_deleted: false } });
const softDelete = (id) =>
  prisma.city.update({ where: { id }, data: { is_deleted: true, is_active: false } });

/**
 * Rattache / déplace une ville vers une autre région.
 * Impact aval : les nodes de la ville suivent la nouvelle région
 * (nodes.region_id doit rester cohérent avec cities.region_id).
 * customers / addresses ne référencent que city_id : aucun impact.
 */
const moveToRegion = (id, regionId, extra = {}) =>
  prisma.$transaction(async (tx) => {
    const nodes = await tx.node.updateMany({
      where: { city_id: id },
      data: { region_id: regionId },
    });
    const city = await tx.city.update({
      where: { id },
      data: { ...extra, region_id: regionId },
      include: INCLUDE,
    });
    return { city, nodes_updated: nodes.count };
  });

module.exports = { findAll, findById, findByCode, create, update, countNodes, softDelete, moveToRegion };
