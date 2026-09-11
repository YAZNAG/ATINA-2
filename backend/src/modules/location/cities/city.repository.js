const prisma = require('../../../config/database');

const INCLUDE = {
  region: {
    select: { id: true, code: true, name_fr: true, name_ar: true },
  },
  _count: { select: { nodes: { where: { is_deleted: false } } } },
};

const bool = (v) => v === 'true' || v === true;

// Par défaut les villes supprimées (soft-delete) sont exclues ; `is_deleted=true` les affiche seules.
const buildWhere = ({ search, region_id, is_active, is_deleted }) => ({
  ...(is_deleted !== undefined && is_deleted !== '' && bool(is_deleted)
    ? { OR: [{ is_deleted: true }, { deleted_at: { not: null } }] }
    : { is_deleted: false, deleted_at: null }),
  ...(region_id && { region_id }),
  ...(is_active !== undefined && is_active !== '' && { is_active: bool(is_active) }),
  ...(search && {
    AND: [{
      OR: [
        { name_fr: { contains: search, mode: 'insensitive' } },
        { name_ar: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { postal_code: { contains: search, mode: 'insensitive' } },
      ],
    }],
  }),
});

/** Tri officiel des listes de villes : ordre d'affichage puis nom. */
const ORDER_BY = [{ sort_order: 'asc' }, { name_fr: 'asc' }];

const findAll = async ({ search, region_id, is_active, is_deleted, page = 1, limit = 20 }) => {
  const where = buildWhere({ search, region_id, is_active, is_deleted });
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 20);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.city.findMany({ where, skip, take: limitNum, include: INCLUDE, orderBy: ORDER_BY }),
    prisma.city.count({ where }),
  ]);
  return { data, total };
};

const findById = (id) => prisma.city.findFirst({ where: { id, is_deleted: false, deleted_at: null }, include: INCLUDE });
// Le code est UNIQUE en base (y compris sur les villes supprimées).
const findByCode = (code, excludeId) =>
  prisma.city.findFirst({ where: { code, ...(excludeId && { NOT: { id: excludeId } }) } });
const create = (data) => prisma.city.create({ data, include: INCLUDE });
const update = (id, data) => prisma.city.update({ where: { id }, data, include: INCLUDE });
const countNodes = (cityId) => prisma.node.count({ where: { city_id: cityId, is_deleted: false } });

/** Dépendances actives d'une ville : nodes, clients et adresses non supprimés. */
const countDependencies = async (cityId) => {
  const [nodes, customers, addresses] = await Promise.all([
    prisma.node.count({ where: { city_id: cityId, is_deleted: false } }),
    prisma.customer.count({ where: { city_id: cityId, is_deleted: false } }),
    prisma.address.count({ where: { city_id: cityId, is_deleted: false } }),
  ]);
  return { nodes, customers, addresses };
};

const softDelete = (id) =>
  prisma.city.update({ where: { id }, data: { is_deleted: true, is_active: false, deleted_at: new Date() } });

/** Prochain rang d'affichage dans une région (fin de liste). */
const nextSortOrder = async (regionId) => {
  const agg = await prisma.city.aggregate({
    where: { region_id: regionId, is_deleted: false },
    _max: { sort_order: true },
  });
  return (agg._max.sort_order ?? 0) + 1;
};

/**
 * Réordonnancement ↑↓ : la ville échange sa place avec sa voisine dans sa région,
 * puis les rangs de la région sont renumérotés 1..n (ordre stable, sans doublon).
 */
const reorderInRegion = (id, regionId, direction) =>
  prisma.$transaction(async (tx) => {
    const rows = await tx.city.findMany({
      where: { region_id: regionId, is_deleted: false, deleted_at: null },
      orderBy: ORDER_BY,
      select: { id: true, sort_order: true },
    });
    const idx = rows.findIndex((r) => r.id === id);
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || target < 0 || target >= rows.length) return { moved: false, rows };
    [rows[idx], rows[target]] = [rows[target], rows[idx]];
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i].sort_order !== i + 1) {
        await tx.city.update({ where: { id: rows[i].id }, data: { sort_order: i + 1 } });
      }
    }
    return { moved: true, rows: rows.map((r, i) => ({ id: r.id, sort_order: i + 1 })) };
  });

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

module.exports = {
  findAll, findById, findByCode, create, update, countNodes, countDependencies, softDelete,
  moveToRegion, nextSortOrder, reorderInRegion,
};
