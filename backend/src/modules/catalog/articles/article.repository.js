const prisma = require('../../../config/database');

const BASE_WHERE = { deleted_at: null };

const INCLUDE = {
  family: { select: { id: true, name_fr: true, name_ar: true } },
  category: { select: { id: true, name_fr: true, name_ar: true } },
  sub_category: { select: { id: true, name_fr: true, name_ar: true } },
  brand: { select: { id: true, name_fr: true, name_ar: true, logo: true } },
  unit: { select: { id: true, name_fr: true, name_ar: true, short_name_fr: true } },
  purchase_unit: { select: { id: true, name_fr: true, name_ar: true } },
  sale_unit: { select: { id: true, name_fr: true, name_ar: true } },
  packaging_type: { select: { id: true, name_fr: true, name_ar: true } },
  conservation_type: { select: { id: true, name_fr: true, name_ar: true } },
  article_type: { select: { id: true, name_fr: true, name_ar: true } },
  article_status: { select: { id: true, name_fr: true, name_ar: true, color: true } },
  tax: { select: { id: true, name_fr: true, name_ar: true, rate: true } },
  images: { where: { deleted_at: null }, orderBy: [{ is_main: 'desc' }, { sort_order: 'asc' }] },
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
      { sku: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: search, mode: 'insensitive' } },
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
const findBySku = (sku, excludeId) =>
  prisma.article.findFirst({ where: { sku, ...BASE_WHERE, ...(excludeId && { NOT: { id: excludeId } }) } });
const findByBarcode = (barcode, excludeId) =>
  prisma.article.findFirst({ where: { barcode, ...BASE_WHERE, ...(excludeId && { NOT: { id: excludeId } }) } });

const create = (data) => prisma.article.create({ data, include: INCLUDE });
const update = (id, data) => prisma.article.update({ where: { id }, data, include: INCLUDE });
const softDelete = (id) => prisma.article.update({ where: { id }, data: { deleted_at: new Date(), is_active: false } });

module.exports = { findAll, findById, findBySku, findByBarcode, create, update, softDelete };
