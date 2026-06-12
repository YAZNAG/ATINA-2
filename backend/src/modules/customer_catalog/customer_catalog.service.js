const { selectFields } = require('express-validator/lib/field-selection');
const prisma = require('../../config/database');
const { ensureArticlesPrismaColumns } = require('../../utils/articleSkuLink');
const { toPublicUrl } = require('../../utils/fileStorage');

const BASE_ARTICLE = { deleted_at: null, is_deleted: false, is_active: true };
const BASE_CAT     = { deleted_at: null, status: 'active' };

const ARTICLE_SELECT = {
  id: true, sku_code: true, ean13: true,sku_uuid: true,
  name_fr: true, name_ar: true,
  description_fr: true, description_ar: true,
  price: true, vat_rate: true, unit_sale: true,
  is_active: true,
  brand:        { select: { id: true, name_fr: true, name_ar: true } },
  category:     { select: { id: true, name_fr: true, name_ar: true } },
  sub_category: { select: { id: true, name_fr: true, name_ar: true } },
  catalog_sku: {
    select: {
      id: true,
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
    sku_id: a.catalog_sku?.id ?? null,
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
    image_path:    toPublicUrl(c.image_path),
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

// recommended articles
// ── Produits recommandés pour un client ──────────────────────────────────────
async function getRecommendedArticles(customerId, { limit = 20 } = {}) {
  await ensureArticlesPrismaColumns(prisma);
  console.log('[DEBUG] req.customerId:', customerId, typeof customerId);
  // ── 1. Vérifie que le client existe ──────────────────────────────────────
  const customerExists = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customerExists) {
    throw new Error(`Client introuvable : ${customerId}`);
  }

  // ── 2. Récupère les catégories des produits déjà commandés ───────────────
  const pastOrders = await prisma.order.findMany({
  where: { customer_id: customerId, is_deleted: false },
  select: {
    items: {
      select: {
        sku: {
          select: {
            article: {   // relation inverse Sku → Article
              select: { category_id: true, id: true },
            },
          },
        },
      },
    },
  },
  take: 50,
  orderBy: { created_at: 'desc' },
});

  // ── 3. Extrait category_id et article_id déjà commandés ─────────────────
  const orderedCategoryIds = new Set();
  const orderedArticleIds  = new Set();

  pastOrders
  .flatMap(o => o.items)
  .forEach(item => {
    const art = item.sku?.article;  // peut être null → optional chaining OK
    if (art?.category_id) orderedCategoryIds.add(art.category_id);
    if (art?.id)          orderedArticleIds.add(art.id);
  });

  const hasPastOrders = orderedCategoryIds.size > 0;

  // ── 4. Pas d'historique → retourne les articles les plus récents ─────────
  if (!hasPastOrders) {
    const fallback = await prisma.article.findMany({
      where:   BASE_ARTICLE,
      select:  ARTICLE_SELECT,
      take:    limit,
      orderBy: { created_at: 'desc' },
    });
    return fallback.map(formatArticle);
  }

  // ── 5. Articles des mêmes catégories (hors déjà commandés) ──────────────
  const recommended = await prisma.article.findMany({
    where: {
      ...BASE_ARTICLE,
      category_id: { in: [...orderedCategoryIds] },
      id:          { notIn: [...orderedArticleIds] },
    },
    select:  ARTICLE_SELECT,
    take:    limit,
    orderBy: { created_at: 'desc' },
  });

  // ── 6. Complète si pas assez de résultats ────────────────────────────────
  if (recommended.length >= limit) {
    return recommended.map(formatArticle);
  }

  const remaining   = limit - recommended.length;
  const excludedIds = new Set([
    ...orderedArticleIds,
    ...recommended.map(a => a.id),
  ]);

  const filler = await prisma.article.findMany({
    where: {
      ...BASE_ARTICLE,
      id: { notIn: [...excludedIds] },
    },
    select:  ARTICLE_SELECT,
    take:    remaining,
    orderBy: { created_at: 'desc' },
  });

  return [...recommended, ...filler].map(formatArticle);
}

// ── cities (public — for address form select) ─────────────────────────────────
async function getCities() {
  const cities = await prisma.city.findMany({
    where:   { is_deleted: false, is_active: true },
    select:  { id: true, name_fr: true, name_ar: true, postal_code: true, code: true },
    orderBy: { name_fr: 'asc' },
  });
  return cities;
}

//subCatgories
async function getSubCategories(categoryId) {
  const data = await prisma.subCategory.findMany({
    where: {
      category_id: Number(categoryId),
      deleted_at:  null,
      status:      'active',
    },
    orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }],
    select: {
      id: true, name_fr: true, name_ar: true,
      code: true, image_path: true, icon_path: true,
      sort_order: true,
      _count: { select: { articles: { where: { ...BASE_ARTICLE } } } },
    },
  });

  return data.map(s => ({
    id:            s.id,
    name_fr:       s.name_fr,
    name_ar:       s.name_ar,
    code:          s.code,
    image_path:    s.image_path,
    icon_path:     s.icon_path,
    sort_order:    s.sort_order,
    article_count: s._count.articles,
  }));
}


module.exports = { getCategories, getArticlesByCategory, getArticleDetail, searchArticles, getCities, getSubCategories, getRecommendedArticles };
