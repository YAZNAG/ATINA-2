const prisma = require('../../config/database');
const { toPublicUrl } = require('../../utils/fileStorage');
const { applyDiscount } = require('../flash_sale/article_discount');

/*
 * « Offre » d'un SKU sur un node pour l'app cliente (ex-« article ») :
 *  - prix affiché TTC = selling_rules.price du node (skus.price n'est plus un prix de vente) ;
 *  - vendable = selling_rules.is_sellable ET prix > 0 ;
 *  - disponible = vendable ET (stock_levels.qty_available > 0 OU vente en rupture autorisée
 *    — is_backorderable ET (backorder_limit = 0 OU backordered_quantity < backorder_limit)) ;
 *  - images = sku_images non supprimées, is_primary desc, sort_order asc ;
 *  - vente flash du node (ciblage SKU / catégorie / marque, quota non épuisé).
 * L'identifiant « article » renvoyé à l'app est l'id du SKU (id = sku_id).
 */

const NO_NODE = '00000000-0000-0000-0000-000000000000';
const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

const SKU_BASE_WHERE = { is_active: true, is_deleted: false, deleted_at: null };

/** Filtre Prisma « SKU disponible à la vente sur le node ». */
function sellableWhere(nodeId) {
  if (!nodeId) return { id: { in: [] } };
  const rule = { node_id: nodeId, is_sellable: true, price: { gt: 0 } };
  return {
    ...SKU_BASE_WHERE,
    OR: [
      {
        selling_rules: { some: rule },
        stock_levels:  { some: { node_id: nodeId, qty_available: { gt: 0 } } },
      },
      { selling_rules: { some: { ...rule, is_backorderable: true, backorder_limit: 0 } } },
      {
        selling_rules: {
          some: {
            ...rule,
            is_backorderable: true,
            backordered_quantity: { lt: prisma.sellingRule.fields.backorder_limit },
          },
        },
      },
    ],
  };
}

const IMAGES_SELECT = {
  where:   { deleted_at: null },
  orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }, { created_at: 'asc' }],
  select:  { url: true },
  take:    8,
};

function skuSelect(nodeId) {
  const node_id = nodeId || NO_NODE;
  return {
    id: true, sku_code: true, ean13: true,
    name_fr: true, name_ar: true,
    description_fr: true, description_ar: true,
    vat_rate: true, unit_sale: true, weight_g: true, volume_ml: true,
    is_active: true, updated_at: true, created_at: true,
    category_id: true, brand_id: true,
    tax:           { select: { rate: true } },
    brand:         { select: { id: true, name_fr: true, name_ar: true } },
    category:      { select: { id: true, name_fr: true, name_ar: true } },
    sku_family:    { select: { id: true, code: true, name_fr: true, name_ar: true } },
    sku_subfamily: { select: { id: true, code: true, name_fr: true, name_ar: true } },
    images:        IMAGES_SELECT,
    selling_rules: {
      where:  { node_id },
      select: {
        is_sellable: true, price: true, is_backorderable: true,
        backorder_limit: true, backordered_quantity: true, estimated_restock_days: true,
      },
    },
    stock_levels: { where: { node_id }, select: { qty_available: true } },
  };
}

/** Ventes flash EN COURS du node (hors packs), quota non épuisé (stock_flash NULL = illimité). */
async function getNodeFlashSales(nodeId) {
  if (!nodeId) return [];
  const now = new Date();
  const rows = await prisma.flashSale.findMany({
    where: {
      node_id: nodeId, pack_id: null,
      is_active: true, is_deleted: false,
      starts_at: { lte: now }, ends_at: { gte: now },
    },
    select: {
      id: true, node_id: true, sku_id: true, category_id: true, brand_id: true,
      discount_type: true, discount_value: true, flash_price: true,
      stock_flash: true, sold_count: true, ends_at: true,
    },
  });
  return rows.filter((r) => r.stock_flash == null || r.sold_count < r.stock_flash);
}

/** Meilleure vente flash applicable (mêmes règles que le checkout). */
function bestFlashDeal(flashSales, { skuId, categoryId, brandId, nodeId, priceTtc }) {
  let best = null;
  for (const fs of flashSales || []) {
    if (fs.pack_id) continue;
    if (nodeId && fs.node_id && fs.node_id !== nodeId) continue;
    let candidate = null;
    if (fs.sku_id) {
      if (fs.sku_id !== skuId) continue;
      candidate = fs.flash_price != null
        ? Number(fs.flash_price)
        : applyDiscount(priceTtc, fs.discount_type, fs.discount_value);
    } else if (fs.category_id && fs.category_id === categoryId) {
      candidate = applyDiscount(priceTtc, fs.discount_type, fs.discount_value);
    } else if (fs.brand_id && fs.brand_id === brandId) {
      candidate = applyDiscount(priceTtc, fs.discount_type, fs.discount_value);
    }
    if (candidate != null && candidate < priceTtc && (!best || candidate < best.price_ttc)) {
      best = { price_ttc: round2(candidate), fs };
    }
  }
  if (!best) return null;
  return {
    price_ttc:     best.price_ttc,
    old_price_ttc: priceTtc,
    discount_pct:  priceTtc > 0 ? Math.round((1 - best.price_ttc / priceTtc) * 100) : 0,
    flash_sale_id: best.fs.id,
    flash_ends_at: best.fs.ends_at ?? null,
  };
}

/** Situation d'un SKU (sélectionné avec skuSelect(nodeId)) sur le node. */
function skuNodeState(sku) {
  const rule  = sku.selling_rules?.[0] ?? null;
  const stock = sku.stock_levels?.[0] ?? null;
  const priceTtc = round2(rule?.price ?? 0);
  const qtyAvailable = Math.max(0, Number(stock?.qty_available ?? 0));
  const limit = Number(rule?.backorder_limit ?? 0);
  const backorderOk = !!rule?.is_backorderable
    && (limit === 0 || Number(rule.backordered_quantity ?? 0) < limit);
  const isSellable = !!rule?.is_sellable && priceTtc > 0;
  return {
    rule, priceTtc, qtyAvailable, backorderOk, isSellable,
    isAvailable: isSellable && (qtyAvailable > 0 || backorderOk),
  };
}

function skuImageUrls(sku) {
  return [...new Set((sku.images ?? []).map((i) => toPublicUrl(i.url)).filter(Boolean))];
}

const refOf = (x) => (x ? { id: x.id, name_fr: x.name_fr, name_ar: x.name_ar } : null);

/**
 * Format « Article » attendu par l'app (services/catalog.service.ts), alimenté par le SKU.
 * price = HT dérivé du TTC ; price_ttc = prix node (ou prix flash) ; old_price_ttc/discount_pct si flash.
 */
function formatSkuOffer(sku, { nodeId = null, flashSales = [] } = {}) {
  const vatRate = Number(sku.tax?.rate ?? sku.vat_rate ?? 20);
  const st = skuNodeState(sku);
  const deal = st.isSellable
    ? bestFlashDeal(flashSales, {
      skuId: sku.id, categoryId: sku.category_id, brandId: sku.brand_id, nodeId, priceTtc: st.priceTtc,
    })
    : null;
  const images = skuImageUrls(sku);

  return {
    id:             sku.id,
    sku_code:       sku.sku_code,
    sku_id:         sku.id,
    ean13:          sku.ean13,
    name_fr:        sku.name_fr,
    name_ar:        sku.name_ar,
    description_fr: sku.description_fr,
    description_ar: sku.description_ar,
    price:          round2(st.priceTtc / (1 + vatRate / 100)),
    vat_rate:       vatRate,
    price_ttc:      deal ? deal.price_ttc : st.priceTtc,
    old_price_ttc:  deal ? deal.old_price_ttc : null,
    discount_pct:   deal ? deal.discount_pct : null,
    flash_sale_id:  deal ? deal.flash_sale_id : null,
    unit_sale:      sku.unit_sale,
    weight_g:       sku.weight_g ?? null,
    volume_ml:      sku.volume_ml ?? null,
    is_active:      sku.is_active,
    brand:          refOf(sku.brand),
    category:       refOf(sku.category),
    // sous-catégories supprimées : la « sous-catégorie » affichée est la sous-famille SKU
    sub_category:   refOf(sku.sku_subfamily),
    family:         refOf(sku.sku_family),
    subfamily:      refOf(sku.sku_subfamily),
    updated_at:     sku.updated_at,
    image_url:      images[0] ?? null,
    images,
    node_id:                nodeId,
    is_sellable:            st.isSellable,
    is_available:           st.isAvailable,
    in_stock:               st.qtyAvailable > 0,
    is_backorderable:       st.backorderOk,
    estimated_restock_days: st.rule?.estimated_restock_days ?? null,
  };
}

module.exports = {
  NO_NODE, SKU_BASE_WHERE, round2,
  sellableWhere, skuSelect, getNodeFlashSales, bestFlashDeal,
  skuNodeState, skuImageUrls, formatSkuOffer,
};
