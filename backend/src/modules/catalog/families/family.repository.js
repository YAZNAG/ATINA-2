const prisma = require('../../../config/database');

const BASE_WHERE = { deleted_at: null };

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

const findByIdIncludingDeleted = (id) => prisma.skuFamily.findUnique({ where: { id } });
const restore = (id) =>
  prisma.skuFamily.update({ where: { id }, data: { deleted_at: null, is_deleted: false } });

const findAll = async ({ search, status, page = 1, limit = 20 }) => {
  const where = buildWhere({ search, status });
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.skuFamily.findMany({ where, skip, take: limitNum, orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }] }),
    prisma.skuFamily.count({ where }),
  ]);
  return { data, total };
};

const findAll_noPage = () =>
  prisma.skuFamily.findMany({
    where: { ...BASE_WHERE, is_active: true },
    orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }],
  });

const findById = (id) => prisma.skuFamily.findFirst({ where: { id, ...BASE_WHERE } });
const findByCode = (code, excludeId) =>
  prisma.skuFamily.findFirst({ where: { code, ...BASE_WHERE, ...(excludeId && { NOT: { id: excludeId } }) } });

const countSubfamilies = (familyId) =>
  prisma.skuSubFamily.count({ where: { family_id: familyId, is_deleted: false } });

const countArticles = (familyId) =>
  prisma.article.count({ where: { sku_family_id: familyId, is_deleted: false } });

const create = (data) => prisma.skuFamily.create({ data });
const update = (id, data) => prisma.skuFamily.update({ where: { id }, data });
const softDelete = (id) =>
  prisma.skuFamily.update({ where: { id }, data: { deleted_at: new Date(), is_deleted: true } });

const reorder = (items) =>
  prisma.$transaction(
    items.map(({ id, sort_order }) =>
      prisma.skuFamily.update({ where: { id }, data: { sort_order } })
    )
  );

module.exports = {
  findAll, findAll_noPage, findById, findByIdIncludingDeleted,
  findByCode, countSubfamilies, countArticles, create, update, softDelete, restore,
  reorder,
};