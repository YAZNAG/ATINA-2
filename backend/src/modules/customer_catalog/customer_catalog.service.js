const { selectFields } = require('express-validator/lib/field-selection');
const prisma = require('../../config/database');
const { ensureArticlesPrismaColumns } = require('../../utils/articleSkuLink');
const { toPublicUrl } = require('../../utils/fileStorage');
const { getActiveFlashSales, resolveArticleDiscount } = require('../flash_sale/article_discount');

const BASE_ARTICLE = { deleted_at: null, is_deleted: false, is_active: true };
const BASE_CAT     = { deleted_at: null, status: 'active' };

const ARTICLE_SELECT = {
  id: true, sku_code: true, ean13: true, sku_uuid: true,
  name_fr: true, name_ar: true,
  description_fr: true, description_ar: true,
  price: true, vat_rate: true, unit_sale: true,
  tax: { select: { rate: true } },  
  is_active: true,
  updated_at: true,
  brand:        { select: { id: true, name_fr: true, name_ar: true } },
  category:     { select: { id: true, name_fr: true, name_ar: true } },
  sub_category: { select: { id: true, name_fr: true, name_ar: true } },
  catalog_sku: {
    select: {
      id: true,
      images: {
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
        select: { url: true },
      },
    },
  },
  images: {
  orderBy: [{ is_main: 'desc' }, { sort_order: 'asc' }, { id: 'asc' }],
  select: { image_path: true },
  take: 8,
},
};

function formatArticle(a, flashSales = []) {
  const vatRate  = parseFloat(a.tax?.rate ?? a.vat_rate ?? 20);
  const price    = parseFloat(a.price ?? 0);
  const priceTtc = Math.round(price * (1 + vatRate / 100) * 100) / 100;

  const skuImgs     = (a.catalog_sku?.images ?? []).map(i => i.url).filter(Boolean);
  const articleImgs = (a.images ?? []).map(i => toPublicUrl(i.image_path)).filter(Boolean);
  const allImages   = [...new Set([...skuImgs, ...articleImgs])];

  const deal = resolveArticleDiscount({
    articleSkuId: a.catalog_sku?.id ?? null,
    categoryId:   a.category?.id ?? null,
    brandId:      a.brand?.id ?? null,
    priceTtc,
  }, flashSales);
  console.log(articleImgs)
  return {
    id:             a.id,
    sku_code:       a.sku_code,
    sku_id:         a.catalog_sku?.id ?? null,
    ean13:          a.ean13,
    name_fr:        a.name_fr,
    name_ar:        a.name_ar,
    description_fr: a.description_fr,
    description_ar: a.description_ar,
    price,
    vat_rate:       vatRate,
    price_ttc:      deal ? deal.price_ttc : priceTtc,
    old_price_ttc:  deal ? deal.old_price_ttc : null,
    discount_pct:   deal ? deal.discount_pct : null,
    unit_sale:      a.unit_sale,
    is_active:      a.is_active,
    brand:          a.brand,
    category:       a.category,
    sub_category:   a.sub_category,
    updated_at:     a.updated_at,
    image_url:      allImages[0] ?? null,
    images:         allImages,
  };
}

// categories 
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
    icon_path:     toPublicUrl(c.icon_path),
    sort_order:    c.sort_order,
    article_count: c._count.articles,
  }));
}

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
  const [data, total, flashSales] = await Promise.all([
    prisma.article.findMany({
      where,
      skip:    (pageNum - 1) * limitNum,
      take:    limitNum,
      select:  ARTICLE_SELECT,
      orderBy: { name_fr: 'asc' },
    }),
    prisma.article.count({ where }),
    getActiveFlashSales(),
  ]);
  return {
    data:       data.map(a => formatArticle(a, flashSales)),
    pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
  };
}

// article detail
async function getArticleDetail(id) {
  await ensureArticlesPrismaColumns(prisma);
  const [a, flashSales] = await Promise.all([
    prisma.article.findFirst({
      where:  { id: Number(id), deleted_at: null, is_deleted: false },
      select: ARTICLE_SELECT,
    }),
    getActiveFlashSales(),
  ]);
  if (!a) throw { statusCode: 404, message: 'Article introuvable' };
  return formatArticle(a, flashSales);
}

async function searchArticles({ page = 1, limit = 20, search, category_id, category_ids } = {}) {
  await ensureArticlesPrismaColumns(prisma);
  const pageNum  = Number(page);
  const limitNum = Number(limit);
  let categoryWhere = {};
  if (Array.isArray(category_ids) && category_ids.length > 0) {
    const ids = category_ids.map(Number).filter((n) => !Number.isNaN(n));
    if (ids.length > 0) categoryWhere = { category_id: { in: ids } };
  } else if (category_id) {
    categoryWhere = { category_id: Number(category_id) };
  }

  const where = {
    ...BASE_ARTICLE,
    ...categoryWhere,
    ...(search && {
      OR: [
        { name_fr: { contains: search, mode: 'insensitive' } },
        { name_ar: { contains: search, mode: 'insensitive' } },
        { sku_code: { contains: search, mode: 'insensitive' } },
        { ean13:    { contains: search, mode: 'insensitive' } },
      ],
    }),
  };
  const [data, total, flashSales] = await Promise.all([
    prisma.article.findMany({
      where, skip: (pageNum - 1) * limitNum, take: limitNum,
      select: ARTICLE_SELECT, orderBy: { name_fr: 'asc' },
    }),
    prisma.article.count({ where }),
    getActiveFlashSales(),
  ]);
  return {
    data:       data.map(a => formatArticle(a, flashSales)),
    pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
  };
}

//Recommende pour vous
async function getRecommendedArticles(customerId, { limit = 20 } = {}) {
  await ensureArticlesPrismaColumns(prisma);
  const [customerExists, flashSales] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } }),
    getActiveFlashSales(),
  ]);
  if (!customerExists) {
    throw new Error(`Client introuvable : ${customerId}`);
  }

  const pastOrders = await prisma.order.findMany({
    where: { customer_id: customerId, is_deleted: false },
    select: {
      items: {
        select: {
          sku: { select: { article: { select: { category_id: true, id: true } } } },
        },
      },
    },
    take: 50,
    orderBy: { created_at: 'desc' },
  });

  //compte le nombre d'achats par categorie 
  const categoryCounts = new Map(); 
  const orderedArticleIds = new Set();

  pastOrders.flatMap(o => o.items).forEach(item => {
    const art = item.sku?.article;
    if (art?.category_id) {
      categoryCounts.set(art.category_id, (categoryCounts.get(art.category_id) ?? 0) + 1);
    }
    if (art?.id) orderedArticleIds.add(art.id);
  });

  const hasPastOrders = categoryCounts.size > 0;

  if (!hasPastOrders) {
    const fallback = await prisma.article.findMany({
      where:   BASE_ARTICLE,
      select:  ARTICLE_SELECT,
      take:    limit,
      orderBy: { created_at: 'desc' },
    });
    return fallback.map(a => formatArticle(a, flashSales));
  }

  // Categories triees par frequence d'achat decroissante
  const rankedCategoryIds = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([catId]) => catId);

  // Recupere les articles 
  const candidates = await prisma.article.findMany({
    where: {
      ...BASE_ARTICLE,
      category_id: { in: rankedCategoryIds },
      id:          { notIn: [...orderedArticleIds] },
    },
    select:  ARTICLE_SELECT,
    take:    limit * 3, 
    orderBy: { created_at: 'desc' },
  });

  const categoryRank = new Map(rankedCategoryIds.map((id, i) => [id, i]));
  const sorted = candidates.sort((a, b) => {
    const rankA = categoryRank.get(a.category_id) ?? 999;
    const rankB = categoryRank.get(b.category_id) ?? 999;
    return rankA - rankB;
  });

  const recommended = sorted.slice(0, limit);

  if (recommended.length >= limit) {
    return recommended.map(a => formatArticle(a, flashSales));
  }

  const remaining   = limit - recommended.length;
  const excludedIds = new Set([...orderedArticleIds, ...recommended.map(a => a.id)]);

  const filler = await prisma.article.findMany({
    where: {
      ...BASE_ARTICLE,
      id: { notIn: [...excludedIds] },
    },
    select:  ARTICLE_SELECT,
    take:    remaining,
    orderBy: { created_at: 'desc' },
  });

  return [...recommended, ...filler].map(a => formatArticle(a, flashSales));
}

async function getCartComplements({ skuIds = [], limit = 10, page = 1 } = {}) {
  await ensureArticlesPrismaColumns(prisma);
  if (skuIds.length === 0) return { data: [], hasMore: false };

  const flashSales = await getActiveFlashSales();

  const coOrders = await prisma.orderItem.findMany({
    where: { sku_id: { in: skuIds } },
    select: { order_id: true },
    distinct: ['order_id'],
    take: 500,
  });

  const orderIds = coOrders.map(o => o.order_id);
  if (orderIds.length === 0) return { data: [], hasMore: false };

  const coItems = await prisma.orderItem.findMany({
    where: { order_id: { in: orderIds }, sku_id: { not: null } },
    select: { sku_id: true, sku: { select: { article: { select: { id: true } } } } },
  });

  const skuIdSet = new Set(skuIds);
  const articleCounts = new Map();

  for (const item of coItems) {
    if (skuIdSet.has(item.sku_id)) continue;
    const articleId = item.sku?.article?.id;
    if (!articleId) continue;
    articleCounts.set(articleId, (articleCounts.get(articleId) ?? 0) + 1);
  }

  if (articleCounts.size === 0) return { data: [], hasMore: false };

  const rankedAll = [...articleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const skip = (Number(page) - 1) * Number(limit);
  const pageIds = rankedAll.slice(skip, skip + Number(limit));
  const hasMore = rankedAll.length > skip + Number(limit);
  if (pageIds.length === 0) return { data: [], hasMore: false };

  const articles = await prisma.article.findMany({
    where: { ...BASE_ARTICLE, id: { in: pageIds } },
    select: ARTICLE_SELECT,
  });

  const rankMap = new Map(pageIds.map((id, i) => [id, i]));
  const ordered = articles.sort((a, b) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999));

  return { data: ordered.map(a => formatArticle(a, flashSales)), hasMore };
}

//top rated
async function getTopRatedArticles({ limit = 10, page = 1 } = {}) {
  await ensureArticlesPrismaColumns(prisma);
  const flashSales = await getActiveFlashSales();
  const skip = (Number(page) - 1) * Number(limit);

  const grouped = await prisma.articleReview.groupBy({
    by: ['article_id'],
    where: { is_deleted: false },
    _avg: { rating: true },
    _count: { rating: true },
    having: { rating: { _avg: { gte: 4.5 } } },
    orderBy: { _count: { rating: 'desc' } },
    skip,
    take: Number(limit) + 1,
  });

  const hasMore = grouped.length > Number(limit);
  const pageGrouped = grouped.slice(0, Number(limit));
  const ranked = pageGrouped.map(g => g.article_id);
  if (ranked.length === 0) return { data: [], hasMore: false };

  const articles = await prisma.article.findMany({
    where: { ...BASE_ARTICLE, id: { in: ranked } },
    select: ARTICLE_SELECT,
  });

  const rankMap = new Map(ranked.map((id, i) => [id, i]));
  const ordered = articles.sort((a, b) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999));

  return { data: ordered.map(a => formatArticle(a, flashSales)), hasMore };
}

// Cities
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

//Produits populaires
async function getPopularArticles({ limit = 10, page = 1, days = 30 } = {}) {
  await ensureArticlesPrismaColumns(prisma);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const skip  = (Number(page) - 1) * Number(limit);

  const topSkus = await prisma.orderItem.groupBy({
    by: ['sku_id'],
    where: {
      sku_id: { not: null },
      order: { is_deleted: false, created_at: { gte: since } },
    },
    _sum: { qty: true },
    orderBy: { _sum: { qty: 'desc' } },
    skip,
    take: Number(limit) + 1, // +1 pour détecter s'il reste des pages
  });

  const hasMore = topSkus.length > Number(limit);
  const pageSkus = topSkus.slice(0, Number(limit));
  const skuIds = pageSkus.map(t => t.sku_id).filter(Boolean);
  if (skuIds.length === 0) return { data: [], hasMore: false };

  const [skus, flashSales] = await Promise.all([
    prisma.sku.findMany({
      where: { id: { in: skuIds } },
      select: { id: true, article: { select: ARTICLE_SELECT } },
    }),
    getActiveFlashSales(),
  ]);

  const rankMap = new Map(skuIds.map((id, i) => [id, i]));
  const ordered = skus
    .filter(s => s.article)
    .sort((a, b) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999));

  return { data: ordered.map(s => formatArticle(s.article, flashSales)), hasMore };
}

module.exports = {
  getCategories, getArticlesByCategory, getArticleDetail, searchArticles,
  getCities, getSubCategories, getRecommendedArticles, getPopularArticles,
  getCartComplements, getTopRatedArticles,
};
