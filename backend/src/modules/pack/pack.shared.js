const prisma = require('../../config/database');

const PACK_INCLUDE = {
  pack_items: {
    include: {
      sku: {
        select: {
          id: true,
          name_fr: true, name_ar: true, sku_code: true, price: true,
          unit_sale: true, vat_rate: true,
          category_id: true,
          tax: { select: { rate: true } },
          images: {
            where:  { is_primary: true },
            select: { url: true },
            take: 1,
          },
          stock_levels: {
            select: { node_id: true, qty_available: true },
          },
          selling_rules: {
            select: { node_id: true, is_backorderable: true, is_sellable: true },
          },
        },
      },
    },
    orderBy: { sort_order: 'asc' },
  },
};

function computePackPrices(packItems, { discount_type, discount_value, total_price } = {}) {
  const original = packItems.reduce((sum, it) => {
    const priceHt = Number(it.unit_price_in_pack ?? it.sku?.price ?? 0);
    const vatRate = Number(it.sku?.tax?.rate ?? it.sku?.vat_rate ?? 20);
    const priceTtc = Math.round(priceHt * (1 + vatRate / 100) * 100) / 100; 
    const qty = Number(it.qty ?? 1);
    return sum + priceTtc * qty;
  }, 0);

  const originalPrice = Math.round(original * 100) / 100;

  let finalPrice;
  if (discount_type === 'percentage') {
    const val = Number(discount_value ?? 0);
    if (val < 0 || val > 100) throw { statusCode: 400, message: 'Pourcentage invalide (0-100)' };
    finalPrice = originalPrice * (1 - val / 100);
  } else if (discount_type === 'fixed') {
    finalPrice = Number(total_price ?? discount_value ?? 0);
  } else {
    finalPrice = total_price != null ? Number(total_price) : originalPrice;
  }

  finalPrice = Math.round(finalPrice * 100) / 100;
  if (finalPrice > originalPrice) finalPrice = originalPrice;
  if (finalPrice < 0) finalPrice = 0;

  const discountPct = originalPrice > 0
    ? Math.round((1 - finalPrice / originalPrice) * 100)
    : 0;

  return { originalPrice, finalPrice, discountPct };
}

function resolveImageUrl(imagePath) {
  if (!imagePath) return null;
  if (/^https?:\/\//.test(imagePath)) return imagePath;
  const base = process.env.BASE_URL ;
  if (!base) throw { statusCode: 500, message: 'BASE_URL non configurée' };
  return `${base}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
}

function resolveComponentAvailability(sku, packNodeId) {
  const stockRows = sku?.stock_levels ?? [];
  const ruleRows = sku?.selling_rules ?? [];

  if (packNodeId) {
    const stock = stockRows.find(s => s.node_id === packNodeId);
    const rule = ruleRows.find(r => r.node_id === packNodeId);
    return {
      qtyAvailable: Number(stock?.qty_available ?? 0),
      isBackorderable: rule?.is_backorderable ?? false,
      isSellable: rule?.is_sellable ?? true,
    };
  }

  // No node on the pack: aggregate across all nodes.
  const qtyAvailable = stockRows.reduce((sum, s) => sum + Number(s.qty_available ?? 0), 0);
  const isBackorderable = ruleRows.some(r => r.is_backorderable);
  const isSellable = ruleRows.length === 0 || ruleRows.some(r => r.is_sellable);
  return { qtyAvailable, isBackorderable, isSellable };
}

function computePackAvailability(packItems, packNodeId, maxPackQty, overrideBackorderable) {
  if (!packItems.length) {
    return { assemblableCount: 0, vendableCount: 0, isAvailable: false, effectiveBackorderable: !!overrideBackorderable };
  }

  let assemblableCount = Infinity;
  let allBackorderable = true;

  packItems.forEach(it => {
    const { qtyAvailable, isBackorderable } = resolveComponentAvailability(it.sku, packNodeId);
    const qtyRequise = Number(it.qty ?? 1);
    const itemAssemblable = qtyRequise > 0 ? Math.floor(qtyAvailable / qtyRequise) : 0;
    assemblableCount = Math.min(assemblableCount, itemAssemblable);
    if (!isBackorderable) allBackorderable = false;
  });

  assemblableCount = Math.max(0, assemblableCount);
  const cap = maxPackQty != null ? Number(maxPackQty) : Infinity;
  const vendableCount = Math.min(assemblableCount, cap);
  // L'override admin (is_backorderable sur le pack) prime sur les règles SKU.
  const effectiveBackorderable = overrideBackorderable === true ? true : allBackorderable;
  const isAvailable = effectiveBackorderable || assemblableCount >= 1;

  return { assemblableCount, vendableCount, isAvailable, effectiveBackorderable };
}

function formatPack(pack) {
  const items = (pack.pack_items ?? []).map(it => {
    const vatRate = Number(it.sku?.tax?.rate ?? it.sku?.vat_rate ?? 20);
    const priceHt = Number(it.unit_price_in_pack ?? it.sku?.price ?? 0);
    const priceTtc = Math.round(priceHt * (1 + vatRate / 100) * 100) / 100;
    const qty = Number(it.qty ?? 1);

    const { qtyAvailable } = resolveComponentAvailability(it.sku, pack.node_id);
    const itemAssemblable = qty > 0 ? Math.max(0, Math.floor(qtyAvailable / qty)) : 0;

    return {
      sku_id:     it.sku_id,
      name_fr:    it.sku?.name_fr,
      name_ar:    it.sku?.name_ar,
      sku_code:   it.sku?.sku_code,
      qty,
      unit_price: priceTtc,
      unit_label: it.sku?.unit_sale ?? null,
      image_url:  resolveImageUrl(it.sku?.images?.[0]?.url),
      stock_available: qtyAvailable,
      assemblable:     itemAssemblable,
    };
  });

  const { assemblableCount, vendableCount, isAvailable, effectiveBackorderable } =
    computePackAvailability(pack.pack_items ?? [], pack.node_id, pack.max_pack_qty, pack.is_backorderable);

  return {
    id:             pack.id,
    node_id:        pack.node_id,
    name_fr:        pack.name_fr,
    name_ar:        pack.name_ar,
    description_fr: pack.description_fr,
    description_ar: pack.description_ar,
    image_url:      resolveImageUrl(pack.image_url),
    original_price: Number(pack.original_price ?? 0),
    total_price:    Number(pack.total_price ?? 0),
    discount_pct:   pack.discount_pct != null ? Number(pack.discount_pct) : 0,
    saved_amount:   Math.round((Number(pack.original_price ?? 0) - Number(pack.total_price ?? 0)) * 100) / 100,
    valid_from:     pack.valid_from,
    valid_to:       pack.valid_to,
    is_active:      pack.is_active,
    assemblable_count:    assemblableCount,
    vendable_count:       vendableCount,
    max_pack_qty:         pack.max_pack_qty ?? null,
    is_backorderable:     pack.is_backorderable ?? false,
    effective_backorderable: effectiveBackorderable,
    is_available:         isAvailable,
    items,
    item_count:     items.length,
  };
}

function buildImagePayload(pack, formattedItems) {
  return {
    id:             pack.id,
    name_fr:        pack.name_fr,
    original_price: Number(pack.original_price ?? 0),
    total_price:    Number(pack.total_price ?? 0),
    discount_pct:   pack.discount_pct != null ? Number(pack.discount_pct) : 0,
    items:          formattedItems,
  };
}

async function getPackWithItems(packId) {
  return prisma.pack.findFirst({
    where:   { id: packId, is_deleted: false },
    include: PACK_INCLUDE,
  });
}

module.exports = {
  PACK_INCLUDE, computePackPrices, formatPack,
  buildImagePayload, getPackWithItems, resolveImageUrl,
};