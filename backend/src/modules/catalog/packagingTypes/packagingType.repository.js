const prisma = require('../../../config/database');

const BASE_WHERE = { deleted_at: null };
const INCLUDE = { unit: true };

const buildWhere = ({ search, status }) => ({
  ...BASE_WHERE,
  ...(status && { status }),
  ...(search && {
    OR: [
      { name_fr: { contains: search, mode: 'insensitive' } },
      { name_ar: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ],
  }),
});

const findAll = async ({ search, status, page = 1, limit = 20 }) => {
  const where = buildWhere({ search, status });
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.packagingType.findMany({ where, skip, take: limitNum, include: INCLUDE, orderBy: { name_fr: 'asc' } }),
    prisma.packagingType.count({ where }),
  ]);
  return { data, total };
};

const findAll_noPage = ({ unit_id } = {}) =>
  prisma.packagingType.findMany({
    where: {
      ...BASE_WHERE,
      status: 'active',
      ...(unit_id && { unit_id: Number(unit_id) }),
    },
    include: INCLUDE,
    orderBy: { name_fr: 'asc' },
  });

const findById = (id) => prisma.packagingType.findFirst({ where: { id, ...BASE_WHERE }, include: INCLUDE });
const findByCode = (code, excludeId) =>
  prisma.packagingType.findFirst({ where: { code, ...BASE_WHERE, ...(excludeId && { NOT: { id: excludeId } }) } });
const create = (data) => prisma.packagingType.create({ data, include: INCLUDE });
const update = (id, data) => prisma.packagingType.update({ where: { id }, data, include: INCLUDE });
const softDelete = (id) => prisma.packagingType.update({ where: { id }, data: { deleted_at: new Date() } });

module.exports = { findAll, findAll_noPage, findById, findByCode, create, update, softDelete };
