const prisma = require('../../config/database');
const { toPublicUrl } = require('../../utils/fileStorage');

const ARTICLE_WHERE = { is_active: true, is_deleted: false };

const FLASH_INCLUDE = {
  sku: {
    select: {
      id: true,
      article: { select: { name_fr: true, name_ar: true, sku_code: true, price: true } },
    },
  },
  category: { select: { id: true, name_fr: true, _count: { select: { articles: { where: ARTICLE_WHERE } } } } },
  brand:    { select: { id: true, name_fr: true, _count: { select: { articles: { where: ARTICLE_WHERE } } } } },
};

function getScopeType(fs) {
  if (fs.sku_id)      return 'sku';
  if (fs.pack_id)      return 'pack';
  if (fs.category_id) return 'category';
  if (fs.brand_id)     return 'brand';
  return 'unknown';
}

function computeFlashPrice(originalPrice, discount_type, discount_value) {
  const base = Number(originalPrice ?? 0);
  const val  = Number(discount_value ?? 0);

  if (base <= 0) throw { statusCode: 400, message: 'Prix original invalide' };

  const isPct = discount_type === 'percentage' || discount_type === 'pourcentage';
  const isFixed = discount_type === 'fixed';

  if (isPct) {
    if (val <= 0 || val > 100) throw { statusCode: 400, message: 'Pourcentage invalide (1-100)' };
    return Math.round(base * (1 - val / 100) * 100) / 100;
  }

  if (isFixed) {
    if (val <= 0) throw { statusCode: 400, message: 'Prix promo invalide' };
    if (val >= base) throw { statusCode: 400, message: 'Le prix promo doit être inférieur au prix original' };
    return Math.round(val * 100) / 100;
  }

  throw { statusCode: 400, message: `Type de réduction invalide: ${discount_type}. Utilisez 'percentage' ou 'fixed'` };
}

function validateDiscount(discount_type, discount_value) {
  const isPct = discount_type === 'percentage' || discount_type === 'pourcentage';
  const isFixed = discount_type === 'fixed';
  if (!isPct && !isFixed) {
    throw { statusCode: 400, message: `Type de réduction invalide: ${discount_type}. Utilisez 'percentage' ou 'fixed'` };
  }
  const val = Number(discount_value ?? 0);
  if (isPct && (val <= 0 || val > 100)) {
    throw { statusCode: 400, message: 'Pourcentage invalide (1-100)' };
  }
  if (isFixed && val <= 0) {
    throw { statusCode: 400, message: 'Valeur de réduction invalide' };
  }
}

async function getOriginalPrice(sku_id) {
  const sku = await prisma.sku.findUnique({
    where: { id: sku_id },
    select: { article: { select: { price: true } } },
  });

  if (!sku) throw { statusCode: 404, message: 'SKU introuvable' };
  if (!sku.article) throw { statusCode: 400, message: 'Cet SKU n\'a pas d\'article lié' };

  return Number(sku.article.price);
}

function formatPromo(fs) {
  const scopeType = getScopeType(fs);
  const article   = fs.sku?.article;
  const isPct     = fs.discount_type === 'percentage' || fs.discount_type === 'pourcentage';

  const oldPrice = Number(article?.price ?? 0);
  const newPrice = Number(fs.flash_price ?? 0);

  let discountPct   = null;
  let productCount  = null;
  let scopeName     = null;

  if (scopeType === 'sku') {
    discountPct  = oldPrice > 0 ? Math.round((1 - newPrice / oldPrice) * 100) : 0;
    productCount = 1;
    scopeName    = article?.name_fr ?? null;
  } else if (scopeType === 'category') {
    discountPct  = isPct ? Number(fs.discount_value) : null;
    productCount = fs.category?._count?.articles ?? 0;
    scopeName    = fs.category?.name_fr ?? null;
  } else if (scopeType === 'brand') {
    discountPct  = isPct ? Number(fs.discount_value) : null;
    productCount = fs.brand?._count?.articles ?? 0;
    scopeName    = fs.brand?.name_fr ?? null;
  }

  return {
    id:               fs.id,
    scope_type:       scopeType,
    scope_name:       scopeName,
    sku_id:           fs.sku_id,
    pack_id:          fs.pack_id,
    category_id:      fs.category_id,
    brand_id:         fs.brand_id,
    node_id:          fs.node_id,
    name_fr:          fs.name_fr ?? article?.name_fr ?? scopeName,
    name_ar:          fs.name_ar ?? article?.name_ar,
    sku_code:         article?.sku_code,
    image_url:        toPublicUrl(fs.image_url),
    discount_type:    fs.discount_type,
    discount_value:   fs.discount_value != null ? Number(fs.discount_value) : null,
    old_price:        scopeType === 'sku' ? oldPrice : null,
    new_price:        scopeType === 'sku' ? newPrice : null,
    discount_pct:     discountPct,
    saved_amount:     scopeType === 'sku' ? Math.round((oldPrice - newPrice) * 100) / 100 : null,
    product_count:    productCount,
    stock_flash:      fs.stock_flash,
    sold_count:       fs.sold_count,
    remaining_stock:  scopeType === 'sku' ? Math.max(0, (fs.stock_flash ?? 0) - (fs.sold_count ?? 0)) : null,
    max_qty_per_user: fs.max_qty_per_user,
    starts_at:        fs.starts_at,
    ends_at:          fs.ends_at,
    is_active:        fs.is_active,
  };
}

module.exports = {
  FLASH_INCLUDE, getScopeType, computeFlashPrice, validateDiscount, getOriginalPrice, formatPromo,
};
