const prisma = require('../../../config/database');

const BASE_WHERE = { deleted_at: null };
const INCLUDE = { family: { select: { id: true, name_fr: true, name_ar: true } } };

const buildWhere = ({ search, status, family_id }) => {
  const base =
    status === 'deleted'
      ? { deleted_at: { not: null } }
      : {
          deleted_at: null,
          ...(status && status !== 'all' && { is_active: status === 'active' }),
        };
  return {
    ...base,
    ...(family_id && { family_id }),
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
  prisma.skuSubFamily.findUnique({ where: { id }, include: INCLUDE });

const restore = (id) =>
  prisma.skuSubFamily.update({ where: { id }, data: { deleted_at: null, is_deleted: false } });

const findAll = async ({ search, status, family_id, page = 1, limit = 20 }) => {
  const where = buildWhere({ search, status, family_id });
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.skuSubFamily.findMany({
      where, skip, take: limitNum, include: INCLUDE,
      orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }],
    }),
    prisma.skuSubFamily.count({ where }),
  ]);
  return { data, total };
};

const findAll_noPage = (family_id) =>
  prisma.skuSubFamily.findMany({
    where: { ...BASE_WHERE, is_active: true, ...(family_id && { family_id }) },
    orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }],
  });

const findById = (id) => prisma.skuSubFamily.findFirst({ where: { id, ...BASE_WHERE }, include: INCLUDE });
const findByCode = (code, excludeId) =>
  prisma.skuSubFamily.findFirst({ where: { code, ...BASE_WHERE, ...(excludeId && { NOT: { id: excludeId } }) } });

const findFamilyById = (id) => prisma.skuFamily.findFirst({ where: { id, deleted_at: null } });

const countArticles = (subfamilyId) =>
  prisma.article.count({ where: { sku_subfamily_id: subfamilyId, is_deleted: false } });

const create = (data) => prisma.skuSubFamily.create({ data, include: INCLUDE });
const update = (id, data) => prisma.skuSubFamily.update({ where: { id }, data, include: INCLUDE });
const softDelete = (id) =>
  prisma.skuSubFamily.update({ where: { id }, data: { deleted_at: new Date(), is_deleted: true } });

const reorder = (items) =>
  prisma.$transaction(
    items.map(({ id, sort_order }) =>
      prisma.skuSubFamily.update({ where: { id }, data: { sort_order } })
    )
  );

module.exports = {
  findAll, findAll_noPage, findById, findByIdIncludingDeleted,
  findByCode, findFamilyById, countArticles, create, update, softDelete, restore,
  reorder,
};