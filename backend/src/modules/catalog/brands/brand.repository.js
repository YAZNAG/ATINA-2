const prisma = require('../../../config/database');

const BASE_WHERE = { deleted_at: null };

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
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    prisma.brand.findMany({ where, skip, take: limit, orderBy: { name_fr: 'asc' } }),
    prisma.brand.count({ where }),
  ]);
  return { data, total };
};

const findAll_noPage = () =>
  prisma.brand.findMany({ where: { ...BASE_WHERE, status: 'active' }, orderBy: { name_fr: 'asc' } });

const findById = (id) => prisma.brand.findFirst({ where: { id, ...BASE_WHERE } });
const findByCode = (code, excludeId) =>
  prisma.brand.findFirst({ where: { code, ...BASE_WHERE, ...(excludeId && { NOT: { id: excludeId } }) } });
const create = (data) => prisma.brand.create({ data });
const update = (id, data) => prisma.brand.update({ where: { id }, data });
const softDelete = (id) => prisma.brand.update({ where: { id }, data: { deleted_at: new Date() } });

module.exports = { findAll, findAll_noPage, findById, findByCode, create, update, softDelete };
