const prisma = require('../../../config/database');

const BASE_WHERE = { deleted_at: null };

// category.repository.js
const buildWhere = ({ search, status }) => {
  const base =
    status === 'deleted'
      ? { deleted_at: { not: null } }
      : {
          deleted_at: null,
          ...(status && status !== 'all' && { is_active: status === 'active' }),
        };

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

const findByIdIncludingDeleted = (id) =>
  prisma.category.findUnique({ where: { id } });

const restore = (id) =>
  prisma.category.update({ where: { id }, data: { deleted_at: null, is_deleted: false } });

const findAll = async ({ search, status, page = 1, limit = 20 }) => {
  const where = buildWhere({ search, status });
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.category.findMany({ where, skip, take: limitNum, orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }] }),
    prisma.category.count({ where }),
  ]);
  return { data, total };
};

const findAll_noPage = () =>
  prisma.category.findMany({
    where: { ...BASE_WHERE, is_active: true },
    orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }],
  });

const findById = (id) => prisma.category.findFirst({ where: { id, ...BASE_WHERE } });
const findByCode = (code, excludeId) =>
  prisma.category.findFirst({ where: { code, ...BASE_WHERE, ...(excludeId && { NOT: { id: excludeId } }) } });

const countArticles = (catId) =>
  prisma.article.count({ where: { category_id: catId, is_deleted: false } });

const create = (data) => prisma.category.create({ data });
const update = (id, data) => prisma.category.update({ where: { id }, data });
const softDelete = (id) =>
  prisma.category.update({ where: { id }, data: { deleted_at: new Date(), is_deleted: true } });

const reorder = (items) =>
  prisma.$transaction(
    items.map(({ id, sort_order }) =>
      prisma.category.update({
        where: { id },
        data: { sort_order },
      })
    )
  );

module.exports = {
  findAll, findAll_noPage, findById, findByIdIncludingDeleted,
  findByCode, countArticles, create, update, softDelete, restore,
  reorder,
};