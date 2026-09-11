const prisma = require('../../config/database');
const { toPublicUrl } = require('../../utils/fileStorage');
const { isUuid } = require('./customer_node');
const {
  sellableWhere, skuSelect, getNodeFlashSales, formatSkuOffer, SKU_BASE_WHERE,
} = require('./sku_offer');

/*
 * Catalogue client — tout est porté par `skus` (la table `articles` a été fusionnée dans `skus`,
 * `sub_categories` et `families` ont été supprimées). L'« article » renvoyé à l'app = le SKU
 * (id = sku_id = skus.id), prix / vendabilité / stock / flash du node résolu (cf. customer_node.js).
 * `ctx.node` : { id, code, name_fr, name_ar, source } | null.
 */

const CAT_WHERE = { is_active: true, is_deleted: false, deleted_at: null };

const nodeIdOf = (ctx) => ctx?.node?.id ?? null;

function paging(page, limit, { def = 20, max = 100 } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(max, Math.max(1, parseInt(limit, 10) || def));
  return { page: p, limit: l, skip: (p - 1) * l };
}

function searchWhere(search, { withEan = false } = {}) {
  const s = typeof search === 'string' ? search.trim() : '';
  if (!s) return null;
  const or = [
    { name_fr:  { contains: s, mode: 'insensitive' } },
    { name_ar:  { contains: s, mode: 'insensitive' } },
    { sku_code: { contains: s, mode: 'insensitive' } },
  ];
  if (withEan) or.push({ ean13: { contains: s, mode: 'insensitive' } });
  return { OR: or };
}

const and = (...parts) => ({ AND: parts.filter(Boolean) });
const emptyPage = (page, limit) => ({ data: [], pagination: { total: 0, page, limit, pages: 0 } });

async function findOffers(nodeId, where, { orderBy = { name_fr: 'asc' }, skip, take } = {}) {
  const [skus, flashSales] = await Promise.all([
    prisma.sku.findMany({ where, select: skuSelect(nodeId), orderBy, skip, take }),
    getNodeFlashSales(nodeId),
  ]);
  return skus.map((s) => formatSkuOffer(s, { nodeId, flashSales }));
}

async function pagedOffers(nodeId, where, { page, limit, skip }) {
  const [data, total] = await Promise.all([
    findOffers(nodeId, where, { skip, take: limit }),
    prisma.sku.count({ where }),
  ]);
  return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
}

/** Ré-ordonne des offres selon une liste d'ids. */
function orderByIds(offers, ids) {
  const rank = new Map(ids.map((id, i) => [id, i]));
  return offers.sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
}

// ── Catégories (liste plate) ──────────────────────────────────────────────────
async function getCategories(ctx = {}) {
  const nodeId = nodeIdOf(ctx);
  const cats = await prisma.category.findMany({
    where:   CAT_WHERE,
    orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }],
    select: {
      id: true, name_fr: true, name_ar: true, code: true, image_url: true, sort_order: true,
      _count: { select: { skus: { where: sellableWhere(nodeId) } } },
    },
  });
  return cats.map((c) => {
    const img = toPublicUrl(c.image_url);
    return {
      id:            c.id,
      name_fr:       c.name_fr,
      name_ar:       c.name_ar,
      code:          c.code,
      image_url:     img,
      image_path:    img, // compat app (ex image_path / icon_path → image_url unique)
      icon_path:     img,
      sort_order:    c.sort_order,
      article_count: c._count.skus,
    };
  });
}

// ── « Sous-catégories » = sous-familles SKU présentes dans la catégorie ────────
async function getSubCategories(categoryId, ctx = {}) {
  if (!isUuid(String(categoryId))) return [];
  const nodeId = nodeIdOf(ctx);
  const groups = await prisma.sku.groupBy({
    by:    ['sku_subfamily_id'],
    where: and(sellableWhere(nodeId), { category_id: String(categoryId), sku_subfamily_id: { not: null } }),
    _count: { _all: true },
  });
  const ids = groups.map((g) => g.sku_subfamily_id).filter(Boolean);
  if (!ids.length) return [];
  const counts = new Map(groups.map((g) => [g.sku_subfamily_id, g._count._all]));

  const subs = await prisma.skuSubFamily.findMany({
    where:   { id: { in: ids }, is_active: true, is_deleted: false, deleted_at: null },
    orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }],
    select:  {
      id: true, code: true, name_fr: true, name_ar: true, sort_order: true, family_id: true,
      family: { select: { id: true, code: true, name_fr: true, name_ar: true } },
    },
  });
  return subs.map((s) => ({
    id:            s.id,
    name_fr:       s.name_fr,
    name_ar:       s.name_ar,
    code:          s.code,
    image_path:    null,
    icon_path:     null,
    sort_order:    s.sort_order,
    family_id:     s.family_id,
    family:        s.family,
    article_count: counts.get(s.id) ?? 0,
  }));
}

function familyFilters({ sub_category_id, subfamily_id, family_id } = {}) {
  const sub = subfamily_id || sub_category_id;
  const parts = [];
  if (sub && isUuid(String(sub))) parts.push({ sku_subfamily_id: String(sub) });
  if (family_id && isUuid(String(family_id))) parts.push({ sku_family_id: String(family_id) });
  return parts;
}

// ── Articles d'une catégorie ──────────────────────────────────────────────────
async function getArticlesByCategory(categoryId, query = {}, ctx = {}) {
  const pg = paging(query.page, query.limit);
  if (!isUuid(String(categoryId))) return emptyPage(pg.page, pg.limit);
  const nodeId = nodeIdOf(ctx);
  const where = and(
    sellableWhere(nodeId),
    { category_id: String(categoryId) },
    ...familyFilters(query),
    searchWhere(query.search),
  );
  return pagedOffers(nodeId, where, pg);
}

// ── Détail ────────────────────────────────────────────────────────────────────
async function getArticleDetail(id, ctx = {}) {
  if (!isUuid(String(id))) throw { statusCode: 404, message: 'Article introuvable' };
  const nodeId = nodeIdOf(ctx);
  const [sku, flashSales] = await Promise.all([
    prisma.sku.findFirst({ where: { id: String(id), ...SKU_BASE_WHERE }, select: skuSelect(nodeId) }),
    getNodeFlashSales(nodeId),
  ]);
  if (!sku) throw { statusCode: 404, message: 'Article introuvable' };
  const offer = formatSkuOffer(sku, { nodeId, flashSales });
  // L'app traite `sku_id` absent comme « Indisponible » (ajout panier bloqué).
  if (!offer.is_available) offer.sku_id = null;
  return offer;
}

// ── Recherche / liste ─────────────────────────────────────────────────────────
async function searchArticles(query = {}, ctx = {}) {
  const pg = paging(query.page, query.limit);
  const nodeId = nodeIdOf(ctx);

  let categoryWhere = null;
  const ids = (Array.isArray(query.category_ids) ? query.category_ids : [])
    .map(String).filter(isUuid);
  if (ids.length) categoryWhere = { category_id: { in: ids } };
  else if (Array.isArray(query.category_ids) && query.category_ids.length) return emptyPage(pg.page, pg.limit);
  else if (query.category_id) {
    if (!isUuid(String(query.category_id))) return emptyPage(pg.page, pg.limit);
    categoryWhere = { category_id: String(query.category_id) };
  }

  const where = and(
    sellableWhere(nodeId),
    categoryWhere,
    ...familyFilters(query),
    searchWhere(query.search, { withEan: true }),
  );
  return pagedOffers(nodeId, where, pg);
}

// ── Recommandé pour vous ──────────────────────────────────────────────────────
async function getRecommendedArticles(customerId, { limit = 20 } = {}, ctx = {}) {
  const nodeId = nodeIdOf(ctx);
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!customer) throw { statusCode: 404, message: 'Client introuvable' };

  const pastOrders = await prisma.order.findMany({
    where:   { customer_id: customerId, is_deleted: false },
    select:  { items: { select: { sku: { select: { id: true, category_id: true } } } } },
    take:    50,
    orderBy: { created_at: 'desc' },
  });

  const categoryCounts = new Map();
  const orderedSkuIds  = new Set();
  pastOrders.flatMap((o) => o.items).forEach((item) => {
    const sku = item.sku;
    if (!sku) return;
    orderedSkuIds.add(sku.id);
    if (sku.category_id) categoryCounts.set(sku.category_id, (categoryCounts.get(sku.category_id) ?? 0) + 1);
  });

  const base = sellableWhere(nodeId);
  if (categoryCounts.size === 0) {
    return findOffers(nodeId, base, { take: limit, orderBy: { created_at: 'desc' } });
  }

  const rankedCategoryIds = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const categoryRank = new Map(rankedCategoryIds.map((id, i) => [id, i]));

  const candidates = await findOffers(
    nodeId,
    and(base, { category_id: { in: rankedCategoryIds } }, { id: { notIn: [...orderedSkuIds] } }),
    { take: limit * 3, orderBy: { created_at: 'desc' } },
  );
  const recommended = candidates
    .sort((a, b) => (categoryRank.get(a.category?.id) ?? 999) - (categoryRank.get(b.category?.id) ?? 999))
    .slice(0, limit);
  if (recommended.length >= limit) return recommended;

  const excluded = [...orderedSkuIds, ...recommended.map((a) => a.id)];
  const filler = await findOffers(
    nodeId,
    and(base, { id: { notIn: excluded } }),
    { take: limit - recommended.length, orderBy: { created_at: 'desc' } },
  );
  return [...recommended, ...filler];
}

// ── Compléments panier (achetés avec) ─────────────────────────────────────────
async function getCartComplements({ skuIds = [], limit = 10, page = 1 } = {}, ctx = {}) {
  const ids = skuIds.map(String).filter(isUuid);
  if (ids.length === 0) return { data: [], hasMore: false };
  const nodeId = nodeIdOf(ctx);
  const pg = paging(page, limit, { def: 10 });

  const coOrders = await prisma.orderItem.findMany({
    where:    { sku_id: { in: ids } },
    select:   { order_id: true },
    distinct: ['order_id'],
    take:     500,
  });
  const orderIds = coOrders.map((o) => o.order_id);
  if (orderIds.length === 0) return { data: [], hasMore: false };

  const coItems = await prisma.orderItem.findMany({
    where:  { order_id: { in: orderIds }, sku_id: { not: null, notIn: ids } },
    select: { sku_id: true },
  });
  const counts = new Map();
  for (const it of coItems) counts.set(it.sku_id, (counts.get(it.sku_id) ?? 0) + 1);
  if (counts.size === 0) return { data: [], hasMore: false };

  // ne classer que les SKU vendables sur le node, pour une pagination exacte
  const sellable = await prisma.sku.findMany({
    where:  and(sellableWhere(nodeId), { id: { in: [...counts.keys()] } }),
    select: { id: true },
  });
  const rankedAll = sellable.map((s) => s.id).sort((a, b) => counts.get(b) - counts.get(a));
  const pageIds = rankedAll.slice(pg.skip, pg.skip + pg.limit);
  if (pageIds.length === 0) return { data: [], hasMore: false };

  const offers = await findOffers(nodeId, { id: { in: pageIds } });
  return { data: orderByIds(offers, pageIds), hasMore: rankedAll.length > pg.skip + pg.limit };
}

// ── Mieux notés (moyenne ≥ 4,5) ───────────────────────────────────────────────
async function getTopRatedArticles({ limit = 10, page = 1 } = {}, ctx = {}) {
  const nodeId = nodeIdOf(ctx);
  const pg = paging(page, limit, { def: 10 });

  const grouped = await prisma.articleReview.groupBy({
    by:      ['sku_id'],
    where:   { is_deleted: false, sku: sellableWhere(nodeId) },
    _avg:    { rating: true },
    _count:  { rating: true },
    having:  { rating: { _avg: { gte: 4.5 } } },
    orderBy: { _count: { rating: 'desc' } },
    skip:    pg.skip,
    take:    pg.limit + 1,
  });
  const hasMore = grouped.length > pg.limit;
  const ranked = grouped.slice(0, pg.limit).map((g) => g.sku_id);
  if (ranked.length === 0) return { data: [], hasMore: false };

  const offers = await findOffers(nodeId, { id: { in: ranked } });
  return { data: orderByIds(offers, ranked), hasMore };
}

// ── Villes ────────────────────────────────────────────────────────────────────
async function getCities() {
  return prisma.city.findMany({
    where:   { is_deleted: false, is_active: true },
    select:  { id: true, name_fr: true, name_ar: true, postal_code: true, code: true },
    orderBy: { name_fr: 'asc' },
  });
}

// ── Produits populaires (quantités vendues sur N jours) ───────────────────────
async function getPopularArticles({ limit = 10, page = 1, days = 30 } = {}, ctx = {}) {
  const nodeId = nodeIdOf(ctx);
  const pg = paging(page, limit, { def: 10 });
  const d = Number(days) > 0 ? Number(days) : 30;
  const since = new Date(Date.now() - d * 24 * 60 * 60 * 1000);

  const topSkus = await prisma.orderItem.groupBy({
    by: ['sku_id'],
    where: {
      sku_id: { not: null },
      sku:    { is: sellableWhere(nodeId) },
      order:  { is_deleted: false, created_at: { gte: since } },
    },
    _sum:    { qty: true },
    orderBy: { _sum: { qty: 'desc' } },
    skip:    pg.skip,
    take:    pg.limit + 1,
  });
  const hasMore = topSkus.length > pg.limit;
  const skuIds = topSkus.slice(0, pg.limit).map((t) => t.sku_id).filter(Boolean);
  if (skuIds.length === 0) return { data: [], hasMore: false };

  const offers = await findOffers(nodeId, { id: { in: skuIds } });
  return { data: orderByIds(offers, skuIds), hasMore };
}

module.exports = {
  getCategories, getArticlesByCategory, getArticleDetail, searchArticles,
  getCities, getSubCategories, getRecommendedArticles, getPopularArticles,
  getCartComplements, getTopRatedArticles,
};
