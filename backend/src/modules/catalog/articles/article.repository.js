const prisma = require('../../../config/database');

const BASE_WHERE = { deleted_at: null, is_deleted: false };

/** Sans `images` (article_images) : beaucoup de BDD n'ont pas les colonnes Prisma (`is_main`, `deleted_at`, …) → erreur « colonne inexistante ». La galerie se gère via `sku_images` (routes article/sku-images). */
const INCLUDE = {
  family: { select: { id: true, name_fr: true, name_ar: true } },
  category: { select: { id: true, name_fr: true, name_ar: true } },
  sub_category: { select: { id: true, name_fr: true, name_ar: true } },
  brand: { select: { id: true, name_fr: true, name_ar: true } },
  /** 1re image SKU = principale (tri identique au panneau galerie) */
  catalog_sku: {
    select: {
      images: {
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
        take: 1,
        select: { url: true },
      },
    },
  },
};

const buildWhere = ({ search, is_active, family_id, category_id, sub_category_id, brand_id }) => ({
  ...BASE_WHERE,
  ...(is_active !== undefined && { is_active: is_active === 'true' || is_active === true }),
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
});

const findAll = async (params) => {
  const { page = 1, limit = 20, ...filters } = params;
  const where = buildWhere(filters);
  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    prisma.article.findMany({ where, skip, take: Number(limit), include: INCLUDE, orderBy: { created_at: 'desc' } }),
    prisma.article.count({ where }),
  ]);
  return { data, total };
};

const findById = (id) => prisma.article.findFirst({ where: { id, ...BASE_WHERE }, include: INCLUDE });
/** `select: { id: true }` uniquement : évite un `SELECT *` sur toutes les colonnes Prisma (ex. `sku_uuid`) si la BDD n'est pas encore migrée -- erreur PG « colonne … inexistante ». */
const findBySkuCode = (sku_code, excludeId) =>
  prisma.article.findFirst({
    where: { sku_code, ...BASE_WHERE, ...(excludeId && { NOT: { id: excludeId } }) },
    select: { id: true },
  });
const findByEan13 = (ean13, excludeId) =>
  prisma.article.findFirst({
    where: { ean13, ...BASE_WHERE, ...(excludeId && { NOT: { id: excludeId } }) },
    select: { id: true },
  });

const create = (data) => prisma.article.create({ data, include: INCLUDE });
const update = (id, data) => prisma.article.update({ where: { id }, data, include: INCLUDE });
const softDelete = (id) =>
  prisma.article.update({
    where: { id },
    data: { deleted_at: new Date(), is_active: false, is_deleted: true },
  });

module.exports = {
  findAll,
  findById,
  findBySkuCode,
  findByEan13,
  create,
  update,
  softDelete,
  INCLUDE,
};
