const prisma = require('../../../config/database');

const BASE_WHERE = { deleted_at: null };
const INCLUDE = {
  category: {
    select: { id: true, name_fr: true, name_ar: true, family: { select: { id: true, name_fr: true, name_ar: true } } },
  },
};

const buildWhere = ({ search, status, category_id, family_id }) => ({
  ...BASE_WHERE,
  ...(status && { status }),
  ...(category_id && { category_id: Number(category_id) }),
  ...(family_id && { category: { family_id: Number(family_id) } }),
  ...(search && {
    OR: [
      { name_fr: { contains: search, mode: 'insensitive' } },
      { name_ar: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ],
  }),
});

const findAll = async ({ search, status, category_id, family_id, page = 1, limit = 20 }) => {
  const where = buildWhere({ search, status, category_id, family_id });
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.subCategory.findMany({ where, skip, take: limitNum, include: INCLUDE, orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }] }),
    prisma.subCategory.count({ where }),
  ]);
  return { data, total };
};

const findAll_noPage = (category_id) =>
  prisma.subCategory.findMany({
    where: { ...BASE_WHERE, status: 'active', ...(category_id && { category_id: Number(category_id) }) },
    orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }],
  });

const findById = (id) => prisma.subCategory.findFirst({ where: { id, ...BASE_WHERE }, include: INCLUDE });
const findByCode = (code, excludeId) =>
  prisma.subCategory.findFirst({ where: { code, ...BASE_WHERE, ...(excludeId && { NOT: { id: excludeId } }) } });
const countArticles = (subCatId) =>
  prisma.article.count({ where: { sub_category_id: subCatId, deleted_at: null } });
const create = (data) => prisma.subCategory.create({ data, include: INCLUDE });
const update = (id, data) => prisma.subCategory.update({ where: { id }, data, include: INCLUDE });
const softDelete = (id) => prisma.subCategory.update({ where: { id }, data: { deleted_at: new Date() } });

module.exports = { findAll, findAll_noPage, findById, findByCode, countArticles, create, update, softDelete };
