const prisma = require('../../config/database');
const { ensureArticlesPrismaColumns } = require('../../utils/articleSkuLink');

const BASE_ARTICLE = { deleted_at: null, is_deleted: false, is_active: true };
const BASE_CAT     = { deleted_at: null, status: 'active' };

const ARTICLE_SELECT = {
  id: true, sku_code: true, ean13: true,
  name_fr: true, name_ar: true,
  description_fr: true, description_ar: true,
  price: true, vat_rate: true, unit_sale: true,
  is_active: true,
  brand:        { select: { id: true, name_fr: true, name_ar: true } },
  category:     { select: { id: true, name_fr: true, name_ar: true } },
  sub_category: { select: { id: true, name_fr: true, name_ar: true } },
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

function formatArticle(a) {
  const vatRate  = parseFloat(a.vat_rate ?? 0);       // stored as % e.g. 20 = 20%
  const price    = parseFloat(a.price ?? 0);
  const priceTtc = price * (1 + vatRate / 100);
  const imageUrl = a.catalog_sku?.images?.[0]?.url ?? null;
  return {
    id:             a.id,
    sku_code:       a.sku_code,
    ean13:          a.ean13,
    name_fr:        a.name_fr,
    name_ar:        a.name_ar,
    description_fr: a.description_fr,
    description_ar: a.description_ar,
    price,
    vat_rate:       vatRate,
    price_ttc:      Math.round(priceTtc * 100) / 100,
    unit_sale:      a.unit_sale,
    is_active:      a.is_active,
    brand:          a.brand,
    category:       a.category,
    sub_category:   a.sub_category,
    image_url:      imageUrl,
  };
}

// ── categories ────────────────────────────────────────────────────────────────
async function getCategories() {
  const cats = await prisma.category.findMany({
    where:   BASE_CAT,
    orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }],
    select: {
      id: true, name_fr: true, name_ar: true, code: true,
      image_path: true, icon_path: true, sort_order: true,
      _count: { select: { articles: { where: { ...BASE_ARTICLE } } } },
    },
  });
  return cats.map(c => ({
    id:            c.id,
    name_fr:       c.name_fr,
    name_ar:       c.name_ar,
    code:          c.code,
    image_path:    c.image_path,
    icon_path:     c.icon_path,
    sort_order:    c.sort_order,
    article_count: c._count.articles,
  }));
}

// ── articles by category ──────────────────────────────────────────────────────
async function getArticlesByCategory(categoryId, { page = 1, limit = 20, search } = {}) {
  await ensureArticlesPrismaColumns(prisma);
  const pageNum  = Number(page);
  const limitNum = Number(limit);
  const where = {
    ...BASE_ARTICLE,
    category_id: Number(categoryId),
    ...(search && {
      OR: [
        { name_fr: { contains: search, mode: 'insensitive' } },
        { name_ar: { contains: search, mode: 'insensitive' } },
        { sku_code: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };
  const [data, total] = await Promise.all([
    prisma.article.findMany({
      where,
      skip:    (pageNum - 1) * limitNum,
      take:    limitNum,
      select:  ARTICLE_SELECT,
      orderBy: { name_fr: 'asc' },
    }),
    prisma.article.count({ where }),
  ]);
  return {
    data:       data.map(formatArticle),
    pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
  };
}

// ── article detail ────────────────────────────────────────────────────────────
async function getArticleDetail(id) {
  await ensureArticlesPrismaColumns(prisma);
  const a = await prisma.article.findFirst({
    where:  { id: Number(id), deleted_at: null, is_deleted: false },
    select: ARTICLE_SELECT,
  });
  if (!a) throw { statusCode: 404, message: 'Article introuvable' };
  return formatArticle(a);
}

// ── search articles ───────────────────────────────────────────────────────────
async function searchArticles({ page = 1, limit = 20, search, category_id } = {}) {
  await ensureArticlesPrismaColumns(prisma);
  const pageNum  = Number(page);
  const limitNum = Number(limit);
  const where = {
    ...BASE_ARTICLE,
    ...(category_id && { category_id: Number(category_id) }),
    ...(search && {
      OR: [
        { name_fr: { contains: search, mode: 'insensitive' } },
        { name_ar: { contains: search, mode: 'insensitive' } },
        { sku_code: { contains: search, mode: 'insensitive' } },
        { ean13:    { contains: search, mode: 'insensitive' } },
      ],
    }),
  };
  const [data, total] = await Promise.all([
    prisma.article.findMany({
      where, skip: (pageNum - 1) * limitNum, take: limitNum,
      select: ARTICLE_SELECT, orderBy: { name_fr: 'asc' },
    }),
    prisma.article.count({ where }),
  ]);
  return {
    data:       data.map(formatArticle),
    pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
  };
}

module.exports = { getCategories, getArticlesByCategory, getArticleDetail, searchArticles };
