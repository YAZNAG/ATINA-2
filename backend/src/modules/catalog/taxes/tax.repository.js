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
    prisma.tax.findMany({ where, skip, take: limit, orderBy: { rate: 'asc' } }),
    prisma.tax.count({ where }),
  ]);
  return { data, total };
};

const findAll_noPage = () =>
  prisma.tax.findMany({ where: { ...BASE_WHERE, status: 'active' }, orderBy: { rate: 'asc' } });

const findById = (id) => prisma.tax.findFirst({ where: { id, ...BASE_WHERE } });

const findByCode = (code, excludeId) =>
  prisma.tax.findFirst({ where: { code, ...BASE_WHERE, ...(excludeId && { NOT: { id: excludeId } }) } });

const create = (data) => prisma.tax.create({ data });
const update = (id, data) => prisma.tax.update({ where: { id }, data });
const softDelete = (id) => prisma.tax.update({ where: { id }, data: { deleted_at: new Date() } });

module.exports = { findAll, findAll_noPage, findById, findByCode, create, update, softDelete };
