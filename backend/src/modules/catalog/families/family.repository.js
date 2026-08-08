const prisma = require('../../../config/database');

const BASE_WHERE = { deleted_at: null };

const buildWhere = ({ search, status }) => {
  const base =
    status === 'deleted'
      ? { deleted_at: { not: null } }
      : { deleted_at: null, ...(status && status !== 'all' && { status }) };
  return {
    ...base,
    ...(search && {
      OR: [
        { name_fr: { contains: search, mode: 'insensitive' } },
        { name_ar: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };
};

const findByIdIncludingDeleted = (id) => prisma.family.findUnique({ where: { id } });
const restore = (id) => prisma.family.update({ where: { id }, data: { deleted_at: null } });

const findAll = async ({ search, status, page = 1, limit = 20 }) => {
  const where = buildWhere({ search, status });
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.family.findMany({ where, skip, take: limitNum, orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }] }),
    prisma.family.count({ where }),
  ]);
  return { data, total };
};

const findAll_noPage = () =>
  prisma.family.findMany({ where: { ...BASE_WHERE, status: 'active' }, orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }] });

const findById = (id) => prisma.family.findFirst({ where: { id, ...BASE_WHERE } });
const findByCode = (code, excludeId) =>
  prisma.family.findFirst({ where: { code, ...BASE_WHERE, ...(excludeId && { NOT: { id: excludeId } }) } });

const countCategories = (familyId) =>
  prisma.category.count({ where: { family_id: familyId, deleted_at: null } });

const create = (data) => prisma.family.create({ data });
const update = (id, data) => prisma.family.update({ where: { id }, data });
const softDelete = (id) => prisma.family.update({ where: { id }, data: { deleted_at: new Date() } });


module.exports = { findAll, findAll_noPage, findById, findByIdIncludingDeleted, findByCode, countCategories, create, update, softDelete, restore };
