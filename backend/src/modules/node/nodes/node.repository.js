const prisma = require('../../../config/database');

const INCLUDE = {
  node_type: true,
  region: true,
  city: true,
};

const buildWhere = ({ search, is_active, is_deleted, node_type_id, region_id, city_id }) => ({
  ...(is_deleted !== undefined
    ? { is_deleted: is_deleted === 'true' || is_deleted === true }
    : { is_deleted: false }),
  ...(is_active !== undefined && { is_active: is_active === 'true' || is_active === true }),
  ...(node_type_id && { node_type_id }),
  ...(region_id && { region_id }),
  ...(city_id && { city_id }),
  ...(search && {
    OR: [
      { code: { contains: search, mode: 'insensitive' } },
      { name_fr: { contains: search, mode: 'insensitive' } },
      { name_ar: { contains: search, mode: 'insensitive' } },
    ],
  }),
});

const findAll = async (params) => {
  const { page = 1, limit = 20, ...filters } = params;
  const where = buildWhere(filters);
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.node.findMany({ where, skip, take: limitNum, include: INCLUDE, orderBy: [{ created_at: 'desc' }] }),
    prisma.node.count({ where }),
  ]);
  return { data, total };
};

const findById = (id) => prisma.node.findFirst({ where: { id, is_deleted: false }, include: INCLUDE });
const findByCode = (code, excludeId) =>
  prisma.node.findFirst({ where: { code, is_deleted: false, ...(excludeId && { NOT: { id: excludeId } }) } });
const create = (data) => prisma.node.create({ data, include: INCLUDE });
const update = (id, data) => prisma.node.update({ where: { id }, data, include: INCLUDE });
const softDelete = (id) => prisma.node.update({ where: { id }, data: { is_deleted: true, is_active: false } });

module.exports = { findAll, findById, findByCode, create, update, softDelete };