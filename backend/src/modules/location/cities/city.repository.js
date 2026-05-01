const prisma = require('../../../config/database');

const INCLUDE = {
  province: {
    select: { id: true, code: true, name_fr: true, name_ar: true, region: { select: { id: true, name_fr: true } } },
  },
};

const buildWhere = ({ search, province_id, is_active }) => ({
  is_deleted: false,
  ...(province_id && { province_id }),
  ...(is_active !== undefined && { is_active: is_active === 'true' || is_active === true }),
  ...(search && {
    OR: [
      { name_fr: { contains: search, mode: 'insensitive' } },
      { name_ar: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { postal_code: { contains: search, mode: 'insensitive' } },
    ],
  }),
});

const findAll = async ({ search, province_id, is_active, page = 1, limit = 20 }) => {
  const where = buildWhere({ search, province_id, is_active });
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.city.findMany({ where, skip, take: limitNum, include: INCLUDE, orderBy: [{ name_fr: 'asc' }] }),
    prisma.city.count({ where }),
  ]);
  return { data, total };
};

const findById = (id) => prisma.city.findFirst({ where: { id, is_deleted: false }, include: INCLUDE });
const findByCode = (code, excludeId) =>
  prisma.city.findFirst({ where: { code, is_deleted: false, ...(excludeId && { NOT: { id: excludeId } }) } });
const create = (data) => prisma.city.create({ data, include: INCLUDE });
const update = (id, data) => prisma.city.update({ where: { id }, data, include: INCLUDE });
const countNodes = (cityId) => prisma.node.count({ where: { city_id: cityId, is_deleted: false } });
const softDelete = (id) =>
  prisma.city.update({ where: { id }, data: { is_deleted: true, is_active: false } });

module.exports = { findAll, findById, findByCode, create, update, countNodes, softDelete };
