const prisma = require('../../config/database');
const { toPublicUrl } = require('../../utils/fileStorage');

/*
 * Fonctions partagées « flash_sales » (back-office).
 * NB : le modèle Sku porte directement name_fr / sku_code / price (HT) — il n'y a pas de relation « article ».
 */

const SKU_WHERE = { is_active: true, is_deleted: false };

const FLASH_INCLUDE = {
  sku: {
    select: {
      id: true, sku_code: true, name_fr: true, name_ar: true, price: true, vat_rate: true,
      tax: { select: { rate: true } },
      selling_rules: { select: { node_id: true, price: true } },
    },
  },
  pack: {
    select: {
      id: true, node_id: true, name_fr: true, name_ar: true, total_price: true,
      max_pack_qty: true, is_backorderable: true, is_active: true, is_deleted: true,
    },
  },
  node:     { select: { id: true, code: true, name_fr: true } },
  category: { select: { id: true, name_fr: true, _count: { select: { skus: { where: SKU_WHERE } } } } },
  brand:    { select: { id: true, name_fr: true, _count: { select: { skus: { where: SKU_WHERE } } } } },
};

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

function getScopeType(fs) {
  if (fs.sku_id)      return 'sku';
  if (fs.pack_id)     return 'pack';
  if (fs.category_id) return 'category';
  if (fs.brand_id)    return 'brand';
  return 'unknown';
}

/** Prix TTC catalogue d'un SKU (skus.price est HT). */
function skuPriceTtc(sku) {
  const ht = Number(sku?.price ?? 0);
  const rate = Number(sku?.tax?.rate ?? sku?.vat_rate ?? 20);
  return round2(ht * (1 + rate / 100));
}

/**
 * Prix normal de référence d'une cible flash :
 *  - produit : selling_rules.price du couple node × SKU (prix catalogue du node), à défaut prix TTC du SKU ;
 *  - pack    : packs.total_price.
 */
function referencePriceOf(fs) {
  if (fs.sku) {
    const rule = (fs.sku.selling_rules ?? []).find((r) => r.node_id === fs.node_id);
    const rulePrice = Number(rule?.price ?? 0);
    return rulePrice > 0 ? round2(rulePrice) : skuPriceTtc(fs.sku);
  }
  if (fs.pack) return round2(fs.pack.total_price);
  return null;
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

/** Prix normal d'un SKU (sur un node si fourni). */
async function getOriginalPrice(sku_id, node_id = null) {
  const sku = await prisma.sku.findUnique({
    where: { id: sku_id },
    select: {
      price: true, vat_rate: true, tax: { select: { rate: true } },
      selling_rules: node_id ? { where: { node_id }, select: { node_id: true, price: true } } : false,
    },
  });
  if (!sku) throw { statusCode: 404, message: 'SKU introuvable' };
  const rulePrice = Number(sku.selling_rules?.[0]?.price ?? 0);
  return rulePrice > 0 ? round2(rulePrice) : skuPriceTtc(sku);
}

// ————————————————————————————— États d'une vente flash (US-075)

const FLASH_STATUS_LABELS = {
  programmee: 'Programmée',
  en_cours:   'En cours',
  epuisee:    'Épuisée',
  terminee:   'Terminée',
  desactivee: 'Désactivée',
  supprimee:  'Supprimée',
};

/**
 * PROGRAMMÉE : active, avant starts_at · EN COURS : active, dans la fenêtre, quota restant > 0
 * ÉPUISÉE : active, dans la fenêtre, quota restant = 0 · TERMINÉE : après ends_at OU désactivée
 * (« desactivee » = terminée par arrêt volontaire, affichée distinctement).
 */
function flashStatusOf(fs, now = new Date()) {
  if (fs.is_deleted) return 'supprimee';
  if (new Date(fs.ends_at) < now) return 'terminee';
  if (!fs.is_active) return 'desactivee';
  if (new Date(fs.starts_at) > now) return 'programmee';
  if (fs.stock_flash != null && (fs.stock_flash - (fs.sold_count ?? 0)) <= 0) return 'epuisee';
  return 'en_cours';
}

function formatPromo(fs) {
  const scopeType = getScopeType(fs);
  const isPct     = fs.discount_type === 'percentage' || fs.discount_type === 'pourcentage';
  const now       = new Date();

  const refPrice = referencePriceOf(fs);
  const newPrice = fs.flash_price != null ? Number(fs.flash_price) : null;

  let discountPct  = null;
  let productCount = null;
  let scopeName    = null;

  if (scopeType === 'sku' || scopeType === 'pack') {
    discountPct  = refPrice > 0 && newPrice != null ? Math.round((1 - newPrice / refPrice) * 100) : 0;
    productCount = 1;
    scopeName    = scopeType === 'sku' ? (fs.sku?.name_fr ?? null) : (fs.pack?.name_fr ?? null);
  } else if (scopeType === 'category') {
    discountPct  = isPct ? Number(fs.discount_value) : null;
    productCount = fs.category?._count?.skus ?? 0;
    scopeName    = fs.category?.name_fr ?? null;
  } else if (scopeType === 'brand') {
    discountPct  = isPct ? Number(fs.discount_value) : null;
    productCount = fs.brand?._count?.skus ?? 0;
    scopeName    = fs.brand?.name_fr ?? null;
  }

  // statut historique (écran « Promotions »)
  let statusLabel = 'inactive';
  if (fs.is_deleted) statusLabel = 'deleted';
  else if (new Date(fs.ends_at) < now) statusLabel = 'expired';
  else if (fs.is_active) statusLabel = 'active';

  const flashStatus = flashStatusOf(fs, now);
  const isExpired = new Date(fs.ends_at) < now;
  const hasStarted = new Date(fs.starts_at) <= now;
  const isFlash = scopeType === 'sku' || scopeType === 'pack';

  return {
    id:               fs.id,
    scope_type:       scopeType,
    target:           isFlash ? scopeType : null,
    scope_name:       scopeName,
    sku_id:           fs.sku_id,
    pack_id:          fs.pack_id,
    category_id:      fs.category_id,
    brand_id:         fs.brand_id,
    node_id:          fs.node_id,
    node_code:        fs.node?.code ?? null,
    node_name:        fs.node?.name_fr ?? null,
    name_fr:          fs.name_fr ?? scopeName,
    name_ar:          fs.name_ar ?? (scopeType === 'sku' ? fs.sku?.name_ar : scopeType === 'pack' ? fs.pack?.name_ar : null) ?? null,
    custom_name_fr:   fs.name_fr ?? null,
    custom_name_ar:   fs.name_ar ?? null,
    sku_code:         fs.sku?.sku_code ?? null,
    pack_name:        fs.pack?.name_fr ?? null,
    image_url:        toPublicUrl(fs.image_url),
    discount_type:    fs.discount_type,
    discount_value:   fs.discount_value != null ? Number(fs.discount_value) : null,
    reference_price:  isFlash ? refPrice : null,
    flash_price:      newPrice,
    old_price:        isFlash ? refPrice : null,
    new_price:        isFlash ? newPrice : null,
    discount_pct:     discountPct,
    saved_amount:     isFlash && refPrice != null && newPrice != null ? round2(refPrice - newPrice) : null,
    product_count:    productCount,
    stock_flash:      fs.stock_flash,
    sold_count:       fs.sold_count,
    remaining_stock:  isFlash ? Math.max(0, (fs.stock_flash ?? 0) - (fs.sold_count ?? 0)) : null,
    remaining_quota:  isFlash ? Math.max(0, (fs.stock_flash ?? 0) - (fs.sold_count ?? 0)) : null,
    max_qty_per_user: fs.max_qty_per_user,
    starts_at:        fs.starts_at,
    ends_at:          fs.ends_at,
    is_active:        fs.is_active,
    is_deleted:       fs.is_deleted,
    deleted_at:       fs.deleted_at ?? null,
    created_at:       fs.created_at,
    updated_at:       fs.updated_at,
    status:           statusLabel,
    flash_status:     flashStatus,
    flash_status_label: FLASH_STATUS_LABELS[flashStatus],
    is_expired:       isExpired,
    has_started:      hasStarted,
    read_only:        !!fs.is_deleted || isExpired,
  };
}

module.exports = {
  FLASH_INCLUDE, FLASH_STATUS_LABELS, getScopeType, computeFlashPrice, validateDiscount,
  getOriginalPrice, formatPromo, flashStatusOf, referencePriceOf, skuPriceTtc, round2,
};
