const prisma = require('../../../config/database');

const BASE_WHERE = { deleted_at: null };
const INCLUDE = { family: { select: { id: true, name_fr: true, name_ar: true } } };

const buildWhere = ({ search, status, family_id }) => ({
  ...BASE_WHERE,
  ...(status && { status }),
  ...(family_id && { family_id: Number(family_id) }),
  ...(search && {
    OR: [
      { name_fr: { contains: search, mode: 'insensitive' } },
      { name_ar: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ],
  }),
});

const findAll = async ({ search, status, family_id, page = 1, limit = 20 }) => {
  const where = buildWhere({ search, status, family_id });
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.category.findMany({ where, skip, take: limitNum, include: INCLUDE, orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }] }),
    prisma.category.count({ where }),
  ]);
  return { data, total };
};

const findAll_noPage = (family_id) =>
  prisma.category.findMany({
    where: { ...BASE_WHERE, status: 'active', ...(family_id && { family_id: Number(family_id) }) },
    orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }],
  });

const findById = (id) => prisma.category.findFirst({ where: { id, ...BASE_WHERE }, include: INCLUDE });
const findByCode = (code, excludeId) =>
  prisma.category.findFirst({ where: { code, ...BASE_WHERE, ...(excludeId && { NOT: { id: excludeId } }) } });
const countSubCategories = (catId) =>
  prisma.subCategory.count({ where: { category_id: catId, deleted_at: null } });
const create = (data) => prisma.category.create({ data, include: INCLUDE });
const update = (id, data) => prisma.category.update({ where: { id }, data, include: INCLUDE });
const softDelete = (id) => prisma.category.update({ where: { id }, data: { deleted_at: new Date() } });

module.exports = { findAll, findAll_noPage, findById, findByCode, countSubCategories, create, update, softDelete };
