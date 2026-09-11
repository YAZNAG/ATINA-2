const prisma = require('../../config/database');
const { toPublicUrl } = require('../../utils/fileStorage');
const { applyDiscount } = require('../flash_sale/article_discount');
const { isUuid } = require('../customer_catalog/customer_node');
const {
  sellableWhere, skuSelect, getNodeFlashSales, formatSkuOffer, round2,
} = require('../customer_catalog/sku_offer');

/*
 * Ventes flash côté client. Les ventes flash sont rattachées à un node : on ne montre que
 * celles du node du client (ctx.node, cf. customer_catalog/customer_node.js). Les produits
 * éligibles sont des SKU vendables sur ce node ; prix de référence = selling_rules.price,
 * prix flash = flash_price (cible SKU) sinon remise discount_type/discount_value.
 */

const MAX_ELIGIBLE = 200;
const nodeIdOf = (ctx) => ctx?.node?.id ?? null;
const isPct = (t) => t === 'percentage' || t === 'pourcentage';

function getScopeType(fs) {
  if (fs.sku_id)      return 'sku';
  if (fs.pack_id)     return 'pack';
  if (fs.category_id) return 'category';
  if (fs.brand_id)    return 'brand';
  return 'unknown';
}

function getScopeName(fs) {
  if (fs.category) return fs.category.name_fr;
  if (fs.brand)    return fs.brand.name_fr;
  if (fs.sku)      return fs.sku.name_fr;
  if (fs.pack)     return fs.pack.name_fr;
  return fs.name_fr ?? null;
}

function computeIsActive(fs) {
  const now = new Date();
  const started  = !fs.starts_at || new Date(fs.starts_at) <= now;
  const notEnded = !fs.ends_at   || new Date(fs.ends_at)   >= now;
  const quotaLeft = fs.stock_flash == null || (fs.sold_count ?? 0) < fs.stock_flash;
  return !!fs.is_active && !fs.is_deleted && started && notEnded && quotaLeft;
}

function activeWhere(nodeId, extra = {}) {
  const now = new Date();
  return {
    is_active: true, is_deleted: false,
    starts_at: { lte: now }, ends_at: { gte: now },
    node_id: nodeId || '00000000-0000-0000-0000-000000000000',
    ...extra,
  };
}

const quotaLeft = (fs) => fs.stock_flash == null || fs.sold_count < fs.stock_flash;

/** Relations nécessaires au résumé d'une vente flash (prix de référence = règle du node). */
function summaryInclude(nodeId) {
  return {
    sku: {
      select: {
        id: true, name_fr: true, name_ar: true,
        selling_rules: { where: { node_id: nodeId }, select: { price: true, is_sellable: true } },
      },
    },
    pack:     { select: { id: true, name_fr: true, name_ar: true, total_price: true } },
    category: { select: { id: true, name_fr: true, name_ar: true, _count: { select: { skus: { where: sellableWhere(nodeId) } } } } },
    brand:    { select: { id: true, name_fr: true, name_ar: true, _count: { select: { skus: { where: sellableWhere(nodeId) } } } } },
  };
}

function formatSummary(fs) {
  const scopeType = getScopeType(fs);

  let discountPct = null;
  if (fs.discount_value != null && isPct(fs.discount_type)) {
    discountPct = parseFloat(fs.discount_value);
  } else if (scopeType === 'sku') {
    const ref = Number(fs.sku?.selling_rules?.[0]?.price ?? 0);
    const flash = fs.flash_price != null ? Number(fs.flash_price) : applyDiscount(ref, fs.discount_type, fs.discount_value);
    if (ref > 0) discountPct = Math.round((1 - flash / ref) * 100);
  } else if (scopeType === 'pack') {
    const ref = Number(fs.pack?.total_price ?? 0);
    const flash = fs.flash_price != null ? Number(fs.flash_price) : applyDiscount(ref, fs.discount_type, fs.discount_value);
    if (ref > 0) discountPct = Math.round((1 - flash / ref) * 100);
  }

  let productCount = 0;
  if (scopeType === 'sku' || scopeType === 'pack') productCount = 1;
  else if (scopeType === 'category') productCount = fs.category?._count?.skus ?? 0;
  else if (scopeType === 'brand')    productCount = fs.brand?._count?.skus ?? 0;

  return {
    id:             fs.id,
    name_fr:        fs.name_fr ?? getScopeName(fs),
    image_url:      toPublicUrl(fs.image_url),
    scope_type:     scopeType,
    scope_name:     getScopeName(fs),
    discount_type:  fs.discount_type,
    discount_value: fs.discount_value != null ? parseFloat(fs.discount_value) : null,
    discount_pct:   discountPct,
    product_count:  productCount,
    ends_at:        fs.ends_at,
    is_active:      computeIsActive(fs),
  };
}

/** SKU vendables sur le node de la vente flash et visés par elle. */
async function loadEligibleSkus(fs) {
  let scope;
  if (fs.sku_id)           scope = { id: fs.sku_id };
  else if (fs.category_id) scope = { category_id: fs.category_id };
  else if (fs.brand_id)    scope = { brand_id: fs.brand_id };
  else return [];
  return prisma.sku.findMany({
    where:   { AND: [sellableWhere(fs.node_id), scope] },
    select:  skuSelect(fs.node_id),
    orderBy: { name_fr: 'asc' },
    take:    MAX_ELIGIBLE,
  });
}

/** Produit éligible (format PromotionProduct de l'app). id = sku_id = skus.id. */
function formatPromotionProduct(sku, fs) {
  const offer = formatSkuOffer(sku, { nodeId: fs.node_id }); // prix node, sans flash
  const oldPrice = offer.price_ttc;
  const newPrice = round2(fs.sku_id && fs.flash_price != null
    ? Number(fs.flash_price)
    : applyDiscount(oldPrice, fs.discount_type, fs.discount_value));
  const isSkuScope = !!fs.sku_id;
  return {
    id:           sku.id,
    sku_id:       sku.id,
    sku_code:     sku.sku_code,
    name_fr:      (isSkuScope && fs.name_fr) || sku.name_fr,
    name_ar:      (isSkuScope && fs.name_ar) || sku.name_ar,
    image_url:    (isSkuScope && toPublicUrl(fs.image_url)) || offer.image_url,
    old_price:    oldPrice,
    new_price:    newPrice,
    discount_pct: oldPrice > 0 ? Math.round((1 - newPrice / oldPrice) * 100) : 0,
    saved_amount: round2(oldPrice - newPrice),
    weight_g:     sku.weight_g ?? null,
    brand:        offer.brand,
    category:     offer.category,
    vat_rate:     offer.vat_rate,
    is_available: offer.is_available,
    flash_sale_id: fs.id,
  };
}

async function formatDetail(fs) {
  const scopeType = getScopeType(fs);
  const eligible = computeIsActive(fs)
    ? (await loadEligibleSkus(fs)).map((s) => formatPromotionProduct(s, fs))
    : [];

  const bannerPct = (fs.discount_value != null && isPct(fs.discount_type))
    ? parseFloat(fs.discount_value)
    : (eligible[0]?.discount_pct ?? null);

  return {
    id:                fs.id,
    name_fr:           fs.name_fr ?? getScopeName(fs),
    name_ar:           fs.name_ar ?? fs.sku?.name_ar ?? fs.category?.name_ar ?? fs.brand?.name_ar ?? fs.pack?.name_ar ?? null,
    image_url:         toPublicUrl(fs.image_url),
    scope_type:        scopeType,
    scope_name:        getScopeName(fs),
    discount_type:     fs.discount_type,
    discount_value:    fs.discount_value != null ? parseFloat(fs.discount_value) : null,
    discount_pct:      bannerPct,
    ends_at:           fs.ends_at,
    is_active:         computeIsActive(fs),
    pack_id:           fs.pack_id ?? null,
    eligible_products: eligible,
    eligible_count:    eligible.length,
  };
}

// ── Meilleures offres : meilleure remise flash par SKU vendable du node ──────
async function listBestDeals(limit = 10, excludeIds = [], page = 1, ctx = {}) {
  const nodeId = nodeIdOf(ctx);
  const flashSales = await getNodeFlashSales(nodeId);
  if (!flashSales.length) return { data: [], hasMore: false };

  const skuIds = flashSales.map((f) => f.sku_id).filter(Boolean);
  const catIds = flashSales.filter((f) => !f.sku_id).map((f) => f.category_id).filter(Boolean);
  const brandIds = flashSales.filter((f) => !f.sku_id).map((f) => f.brand_id).filter(Boolean);
  const scopeOr = [
    skuIds.length   && { id: { in: skuIds } },
    catIds.length   && { category_id: { in: catIds } },
    brandIds.length && { brand_id: { in: brandIds } },
  ].filter(Boolean);
  if (!scopeOr.length) return { data: [], hasMore: false };

  const excludeSet = new Set(excludeIds.filter(Boolean));
  const skus = await prisma.sku.findMany({
    where:  { AND: [sellableWhere(nodeId), { OR: scopeOr }] },
    select: skuSelect(nodeId),
    take:   1000,
  });

  const deals = skus
    .filter((s) => !excludeSet.has(s.id))
    .map((s) => formatSkuOffer(s, { nodeId, flashSales }))
    .filter((o) => o.discount_pct != null && o.discount_pct > 0)
    .sort((x, y) => y.discount_pct - x.discount_pct);

  const l = Math.max(1, Number(limit) || 10);
  const skip = (Math.max(1, Number(page) || 1) - 1) * l;
  return { data: deals.slice(skip, skip + l), hasMore: deals.length > skip + l };
}

async function listActivePromotions(ctx = {}) {
  const nodeId = nodeIdOf(ctx);
  if (!nodeId) return [];
  const sales = await prisma.flashSale.findMany({
    where:   activeWhere(nodeId),
    include: summaryInclude(nodeId),
    orderBy: { ends_at: 'asc' },
  });

  const visible = [];
  for (const fs of sales.filter(quotaLeft)) {
    // une carte flash SKU n'est affichée que si le SKU est vendable sur le node
    if (fs.sku_id) {
      const n = await prisma.sku.count({ where: { AND: [sellableWhere(nodeId), { id: fs.sku_id }] } });
      if (!n) continue;
    }
    visible.push(formatSummary(fs));
  }
  return visible;
}

async function getFlashSaleById(id, ctx = {}) {
  if (!isUuid(String(id))) throw { statusCode: 404, message: 'Promotion introuvable' };
  const base = await prisma.flashSale.findFirst({ where: { id: String(id), is_deleted: false }, select: { node_id: true } });
  if (!base) throw { statusCode: 404, message: 'Promotion introuvable' };
  const fs = await prisma.flashSale.findFirst({
    where:   { id: String(id), is_deleted: false },
    include: summaryInclude(base.node_id),
  });
  return formatDetail(fs);
}

// ── Ventes flash se terminant bientôt ─────────────────────────────────────────
async function listEndingSoon(hours = 24, ctx = {}) {
  const nodeId = nodeIdOf(ctx);
  if (!nodeId) return { ends_at: null, products: [] };
  const h = Number(hours) > 0 ? Number(hours) : 24;
  const soon = new Date(Date.now() + h * 60 * 60 * 1000);

  const sales = (await prisma.flashSale.findMany({
    where:   activeWhere(nodeId, { pack_id: null, ends_at: { gte: new Date(), lte: soon } }),
    include: summaryInclude(nodeId),
    orderBy: { ends_at: 'asc' },
  })).filter(quotaLeft);

  if (sales.length === 0) return { ends_at: null, products: [] };

  const seen = new Set();
  const products = [];
  for (const fs of sales) {
    const detail = await formatDetail(fs);
    for (const p of detail.eligible_products) {
      if (seen.has(p.sku_id)) continue;
      seen.add(p.sku_id);
      products.push(p);
    }
  }
  return { ends_at: sales[0].ends_at, products };
}

// ── Promotions de la page d'accueil ───────────────────────────────────────────
async function listHomePromotions({ endingSoonHours = 24, bestDealsLimit = 10 } = {}, ctx = {}) {
  const endingSoon = await listEndingSoon(endingSoonHours, ctx);
  const excludeIds = endingSoon.products.map((p) => p.id).filter(Boolean);
  const bestDeals = await listBestDeals(bestDealsLimit, excludeIds, 1, ctx);
  return { endingSoon, bestDeals: bestDeals.data };
}

module.exports = { listActivePromotions, getFlashSaleById, listBestDeals, listEndingSoon, listHomePromotions };
