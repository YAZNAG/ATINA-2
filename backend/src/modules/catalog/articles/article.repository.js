const prisma = require('../../../config/database');
const { ensureArticlesPrismaColumns } = require('../../../utils/articleSkuLink');

const BASE_WHERE = { deleted_at: null, is_deleted: false };

const INCLUDE = {
  family: { select: { id: true, name_fr: true, name_ar: true } },
  category: { select: { id: true, name_fr: true, name_ar: true } },
  sub_category: { select: { id: true, name_fr: true, name_ar: true } },
  brand: { select: { id: true, name_fr: true, name_ar: true } },
  images: {
    where: { deleted_at: null },
    orderBy: [{ is_main: 'desc' }, { sort_order: 'asc' }, { id: 'asc' }],
    take: 1,
    select: { image_path: true, is_main: true },
  },
  unit_purchase_ref: { select: { id: true, name_fr: true, code: true } },
  unit_sale_ref: { select: { id: true, name_fr: true, code: true } },
  packaging_type: { select: { id: true, name_fr: true, code: true, quantity: true } },
};

const buildWhere = ({ search, status, family_id, category_id, sub_category_id, brand_id }) => {
  let base;
  if (status === 'deleted') {
    base = { deleted_at: { not: null } };
  } else if (status === 'active') {
    base = { deleted_at: null, is_deleted: false, is_active: true };
  } else if (status === 'inactive') {
    base = { deleted_at: null, is_deleted: false, is_active: false };
  } else {
    base = { deleted_at: null, is_deleted: false };
  }

  return {
    ...base,
    ...(family_id && { family_id: Number(family_id) }),
    ...(category_id && { category_id: Number(category_id) }),
    ...(sub_category_id && { sub_category_id: Number(sub_category_id) }),
    ...(brand_id && { brand_id: Number(brand_id) }),
    ...(search && {
      OR: [
        { name_fr: { contains: search, mode: 'insensitive' } },
        { name_ar: { contains: search, mode: 'insensitive' } },
        { sku_code: { contains: search, mode: 'insensitive' } },
        { ean13: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };
};

const findByIdIncludingDeleted = async (id) => {
  await ensureArticlesPrismaColumns(prisma);
  return prisma.article.findUnique({ where: { id }, include: INCLUDE });
};

const restore = async (id) => {
  await ensureArticlesPrismaColumns(prisma);
  return prisma.article.update({ where: { id }, data: { deleted_at: null, is_deleted: false } });
};


const findAll = async (params) => {
  await ensureArticlesPrismaColumns(prisma);
  const { page = 1, limit = 20, ...filters } = params;
  const where = buildWhere(filters);
  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    prisma.article.findMany({ where, skip, take: Number(limit), include: INCLUDE, orderBy: { created_at: 'desc' } }),
    prisma.article.count({ where }),
  ]);

  return { data, total };
};

const findById = async (id) => {
  await ensureArticlesPrismaColumns(prisma);
  return prisma.article.findFirst({ where: { id, ...BASE_WHERE }, include: INCLUDE });
};
/** `select: { id: true }` uniquement : évite un `SELECT *` sur toutes les colonnes Prisma (ex. `sku_uuid`) si la BDD n'est pas encore migrée -- erreur PG « colonne … inexistante ». */
const findBySkuCode = async (sku_code, excludeId) => {
  await ensureArticlesPrismaColumns(prisma);
  return prisma.article.findFirst({
    where: { sku_code, ...BASE_WHERE, ...(excludeId && { NOT: { id: excludeId } }) },
    select: { id: true },
  });
};
const findByEan13 = async (ean13, excludeId) => {
  await ensureArticlesPrismaColumns(prisma);
  return prisma.article.findFirst({
    where: { ean13, ...BASE_WHERE, ...(excludeId && { NOT: { id: excludeId } }) },
    select: { id: true },
  });
};

const create = async (data) => {
  await ensureArticlesPrismaColumns(prisma);
  return prisma.article.create({ data, include: INCLUDE });
};
const update = async (id, data) => {
  await ensureArticlesPrismaColumns(prisma);
  return prisma.article.update({ where: { id }, data, include: INCLUDE });
};
const softDelete = async (id) => {
  await ensureArticlesPrismaColumns(prisma);
  return prisma.article.update({
    where: { id },
    data: { deleted_at: new Date(), is_active: false, is_deleted: true },
  });
};

module.exports = {
  findAll,
  findById,
  findByIdIncludingDeleted,
  findBySkuCode,
  findByEan13,
  create,
  update,
  softDelete,
  restore,
  INCLUDE,
};
