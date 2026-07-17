const prisma = require('../../config/database');
const { toPublicUrl } = require('../../utils/fileStorage');

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
  if (fs.sku?.article) return fs.sku.article.name_fr;
  return fs.name_fr ?? null;
}

function applyDiscount(priceTtc, discount_type, discount_value) {
  const val = parseFloat(discount_value ?? 0);
  const isPct = discount_type === 'percentage' || discount_type === 'pourcentage';
  if (isPct)             return Math.round(priceTtc * (1 - val / 100) * 100) / 100;
  if (discount_type === 'fixed') return Math.max(0, Math.round((priceTtc - val) * 100) / 100);
  return priceTtc;
}

function priceTtc(price, vat_rate) {
  return Math.round(parseFloat(price ?? 0) * (1 + parseFloat(vat_rate ?? 20) / 100) * 100) / 100;
}

function computeIsActive(fs) {
  const now = new Date();
  const started  = !fs.starts_at || new Date(fs.starts_at) <= now;
  const notEnded = !fs.ends_at   || new Date(fs.ends_at)   >= now;
  return fs.is_active && started && notEnded;
}

function articleImageUrl(a) {
  const skuImg = a.catalog_sku?.images?.[0]?.url ?? null;
  const artImg = a.images?.[0]?.image_path ? toPublicUrl(a.images[0].image_path) : null;
  return skuImg ?? artImg ?? null;
}

function formatArticleProduct(a, fs) {
  const ttc      = priceTtc(a.price, a.vat_rate);
  const newPrice = applyDiscount(ttc, fs.discount_type, fs.discount_value);
  const pct      = ttc > 0 ? Math.round((1 - newPrice / ttc) * 100) : 0;
  return {
    id:           a.id,
    sku_id:       a.catalog_sku?.id ?? a.sku_uuid ?? null,
    name_fr:      a.name_fr,
    name_ar:      a.name_ar,
    image_url:    articleImageUrl(a),
    old_price:    ttc,
    new_price:    newPrice,
    discount_pct: pct,
    saved_amount: Math.round((ttc - newPrice) * 100) / 100,
    weight_g:     a.weight_g ?? null,
    brand:        a.brand ?? null,
  };
}

const ARTICLE_SELECT = {
  id: true, name_fr: true, name_ar: true, sku_code: true,
  price: true, vat_rate: true, weight_g: true, sku_uuid: true,
  catalog_sku: {
    select: {
      id: true,
      images: { select: { url: true }, orderBy: { sort_order: 'asc' }, take: 1 },
    },
  },
  images: { select: { image_path: true }, take: 1 },
  brand:    { select: { id: true, name_fr: true, name_ar: true } },
  category: { select: { id: true, name_fr: true, name_ar: true } },
};

const ARTICLE_WHERE = { is_active: true, is_deleted: false };

const FLASH_LIST_INCLUDE = {
  sku: {
    select: {
      id: true,
      article: { select: { name_fr: true, price: true, vat_rate: true } },
    },
  },
  category: { select: { id: true, name_fr: true, _count: { select: { articles: { where: ARTICLE_WHERE } } } } },
  brand:    { select: { id: true, name_fr: true, _count: { select: { articles: { where: ARTICLE_WHERE } } } } },
};

const FLASH_DETAIL_INCLUDE = {
  sku: {
    select: {
      id: true,
      images: { select: { url: true }, orderBy: { sort_order: 'asc' }, take: 1 },
      article: {
        select: {
          id: true,
          name_fr: true, name_ar: true, price: true, vat_rate: true,
          weight_g: true,
          brand: { select: { id: true, name_fr: true, name_ar: true } },
          images: { select: { image_path: true }, take: 1 },
        },
      },
    },
  },
  category: {
    select: {
      id: true, name_fr: true, name_ar: true,
      articles: { where: ARTICLE_WHERE, select: ARTICLE_SELECT },
    },
  },
  brand: {
    select: {
      id: true, name_fr: true, name_ar: true,
      articles: { where: ARTICLE_WHERE, select: ARTICLE_SELECT },
    },
  },
};


function formatSummary(fs) {
  const scopeType = getScopeType(fs);

  let discountPct = null;
  const isPct = fs.discount_type === 'percentage' || fs.discount_type === 'pourcentage';
  if (fs.discount_value && isPct) {
    discountPct = parseFloat(fs.discount_value);
  } else if (fs.flash_price && fs.sku?.article) {
    const ttc = priceTtc(fs.sku.article.price, fs.sku.article.vat_rate);
    if (ttc > 0) discountPct = Math.round((1 - parseFloat(fs.flash_price) / ttc) * 100);
  }

  let productCount = 0;
  if (scopeType === 'sku')      productCount = 1;
  else if (scopeType === 'category') productCount = fs.category?._count?.articles ?? 0;
  else if (scopeType === 'brand')    productCount = fs.brand?._count?.articles ?? 0;

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

function formatDetail(fs) {
  const scopeType = getScopeType(fs);

  let eligible = [];
  if (scopeType === 'sku' && fs.sku) {
    const a = fs.sku.article;
    const ttc = priceTtc(a?.price, a?.vat_rate);
    const newPrice = parseFloat(fs.flash_price ?? 0);
    const pct = ttc > 0 ? Math.round((1 - newPrice / ttc) * 100) : 0;
    const skuImg = fs.sku.images?.[0]?.url ?? null;
    const artImg = a?.images?.[0]?.image_path ? toPublicUrl(a.images[0].image_path) : null;
    eligible = [{
      id:           a?.id ?? 0,
      sku_id:       fs.sku.id,
      name_fr:      fs.name_fr ?? a?.name_fr ?? null,
      name_ar:      fs.name_ar ?? a?.name_ar ?? null,
      image_url:    fs.image_url ?? skuImg ?? artImg ?? null,
      old_price:    ttc,
      new_price:    newPrice,
      discount_pct: pct,
      saved_amount: Math.round((ttc - newPrice) * 100) / 100,
      brand:        a?.brand ?? null,
      weight_g:     a?.weight_g ?? null,
    }];
  } else if (scopeType === 'category' && fs.category) {
    eligible = fs.category.articles.map(a => formatArticleProduct(a, fs));
  } else if (scopeType === 'brand' && fs.brand) {
    eligible = fs.brand.articles.map(a => formatArticleProduct(a, fs));
  }

  const isPct = fs.discount_type === 'percentage' || fs.discount_type === 'pourcentage';
  const bannerPct = (fs.discount_value && isPct)
    ? parseFloat(fs.discount_value)
    : (eligible[0]?.discount_pct ?? null);

  return {
    id:                fs.id,
    name_fr:           fs.name_fr ?? getScopeName(fs),
    name_ar:           fs.name_ar,
    image_url:         toPublicUrl(fs.image_url),
    scope_type:        scopeType,
    scope_name:        getScopeName(fs),
    discount_type:     fs.discount_type,
    discount_value:    fs.discount_value != null ? parseFloat(fs.discount_value) : null,
    discount_pct:      bannerPct,
    ends_at:           fs.ends_at,
    is_active:         computeIsActive(fs), 
    eligible_products: eligible,
    eligible_count:    eligible.length,
  };
}

const BEST_DEALS_INCLUDE = {
  sku: {
    select: {
      id: true,
      images: { select: { url: true }, orderBy: { sort_order: 'asc' }, take: 1 },
      article: { select: ARTICLE_SELECT },
    },
  },
  category: { select: { articles: { where: ARTICLE_WHERE, select: ARTICLE_SELECT } } },
  brand:    { select: { articles: { where: ARTICLE_WHERE, select: ARTICLE_SELECT } } },
};

async function listBestDeals(limit = 10, excludeIds = [], page = 1) {
  const now = new Date();
  const sales = await prisma.flashSale.findMany({
    where: { is_active: true, is_deleted: false, starts_at: { lte: now }, ends_at: { gte: now } },
    include: BEST_DEALS_INCLUDE,
  });

  const excludeSet = new Set(excludeIds);
  const best = new Map();

  for (const fs of sales) {
    const scopeType = getScopeType(fs);
    let articles = [];
    if (scopeType === 'sku' && fs.sku?.article) {
      articles = [{ ...fs.sku.article, _skuImg: fs.sku.images?.[0]?.url ?? null }];
    } else if (scopeType === 'category' && fs.category) {
      articles = fs.category.articles;
    } else if (scopeType === 'brand' && fs.brand) {
      articles = fs.brand.articles;
    }

    for (const a of articles) {
      if (excludeSet.has(a.id)) continue;

      const ttc = priceTtc(a.price, a.vat_rate);
      const newPrice = (scopeType === 'sku' && fs.flash_price != null)
        ? parseFloat(fs.flash_price)
        : applyDiscount(ttc, fs.discount_type, fs.discount_value);
      const pct = ttc > 0 ? Math.round((1 - newPrice / ttc) * 100) : 0;
      if (pct <= 0) continue;

      const existing = best.get(a.id);
      if (!existing || pct > existing.discount_pct) {
        best.set(a.id, {
          id: a.id,
          sku_id: a.catalog_sku?.id ?? a.sku_uuid ?? null,
          sku_code: a.sku_code ?? null,
          name_fr: a.name_fr,
          name_ar: a.name_ar,
          price: parseFloat(a.price ?? 0),
          price_ttc: newPrice,
          old_price_ttc: ttc,
          discount_pct: pct,
          vat_rate: parseFloat(a.vat_rate ?? 20),
          image_url: articleImageUrl(a) ?? a._skuImg ?? null,
          brand: a.brand ?? null,
          category: a.category ?? null,
        });
      }
    }
  }

  const sorted = Array.from(best.values()).sort((x, y) => y.discount_pct - x.discount_pct);
  const skip = (Number(page) - 1) * Number(limit);
  const pageSlice = sorted.slice(skip, skip + Number(limit));
  const hasMore = sorted.length > skip + Number(limit);

  return { data: pageSlice, hasMore };
}

async function listActivePromotions() {
  const now = new Date();
  const sales = await prisma.flashSale.findMany({
    where: { is_active: true, is_deleted: false, starts_at: { lte: now }, ends_at: { gte: now } },
    include: FLASH_LIST_INCLUDE,
    orderBy: { ends_at: 'asc' },
  });
  return sales.map(formatSummary);
}

async function getFlashSaleById(id) {
  const fs = await prisma.flashSale.findUnique({
    where:   { id, is_deleted: false },
    include: FLASH_DETAIL_INCLUDE,
  });
  if (!fs) throw { statusCode: 404, message: 'Promotion introuvable' };

  const detail = formatDetail(fs);
  if (!detail.is_active) {
    detail.eligible_products = [];
    detail.eligible_count = 0;
  }
  return detail;
}

//Ventes Flash
async function listEndingSoon(hours = 24) {
  const now = new Date();
  const soon = new Date(now.getTime() + hours * 60 * 60 * 1000);

  const sales = await prisma.flashSale.findMany({
    where: {
      is_active: true, is_deleted: false,
      starts_at: { lte: now },
      ends_at:   { gte: now, lte: soon },
    },
    include: FLASH_DETAIL_INCLUDE,
    orderBy: { ends_at: 'asc' },
  });

  if (sales.length === 0) {
    return { ends_at: null, products: [] };
  }

  const seen = new Set();
  const products = [];

  for (const fs of sales) {
    const detail = formatDetail(fs);
    for (const p of detail.eligible_products) {
      const key = p.sku_id ?? `${fs.id}-${p.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      products.push(p);
    }
  }

  return {
    ends_at: sales[0].ends_at, 
    products,
  };
}

//promotions homePage
async function listHomePromotions({ endingSoonHours = 24, bestDealsLimit = 10 } = {}) {
  const endingSoon = await listEndingSoon(endingSoonHours);
  const excludeIds = endingSoon.products.map(p => p.id).filter(id => id > 0);
  const bestDeals = await listBestDeals(bestDealsLimit, excludeIds, 1);
  return { endingSoon, bestDeals: bestDeals.data }; 
}

module.exports = { listActivePromotions, getFlashSaleById, listBestDeals, listEndingSoon, listHomePromotions };

