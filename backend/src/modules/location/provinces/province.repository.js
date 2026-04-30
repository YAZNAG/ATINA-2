const prisma = require('../../../config/database');

const INCLUDE = { region: { select: { id: true, code: true, name_fr: true, name_ar: true } } };

const buildWhere = ({ search, region_id, is_active }) => ({
  is_deleted: false,
  ...(region_id && { region_id }),
  ...(is_active !== undefined && { is_active: is_active === 'true' || is_active === true }),
  ...(search && {
    OR: [
      { name_fr: { contains: search, mode: 'insensitive' } },
      { name_ar: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ],
  }),
});

const findAll = async ({ search, region_id, is_active, page = 1, limit = 20 }) => {
  const where = buildWhere({ search, region_id, is_active });
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.province.findMany({ where, skip, take: limitNum, include: INCLUDE, orderBy: [{ name_fr: 'asc' }] }),
    prisma.province.count({ where }),
  ]);
  return { data, total };
};

const findById = (id) => prisma.province.findFirst({ where: { id, is_deleted: false }, include: INCLUDE });
const findByCode = (code, excludeId) =>
  prisma.province.findFirst({ where: { code, is_deleted: false, ...(excludeId && { NOT: { id: excludeId } }) } });
const create = (data) => prisma.province.create({ data, include: INCLUDE });
const update = (id, data) => prisma.province.update({ where: { id }, data, include: INCLUDE });
const countCities = (provinceId) => prisma.city.count({ where: { province_id: provinceId, is_deleted: false } });

module.exports = { findAll, findById, findByCode, create, update, countCities };
