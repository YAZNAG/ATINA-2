const prisma = require('../../config/database');

const PACK_INCLUDE = {
  pack_items: {
    include: {
      sku: {
        select: {
          id: true,
          article: {
            select: {
              name_fr: true, name_ar: true, sku_code: true, price: true,
              unit_sale: true, 
              images: {
                where:  { is_main: true },
                select: { image_path: true },
                take: 1,
              },
            },
          },
        },
      },
    },
    orderBy: { sort_order: 'asc' },
  },
};

function computePackPrices(packItems, { discount_type, discount_value, total_price } = {}) {
  const original = packItems.reduce((sum, it) => {
    const price = Number(it.sku?.article?.price ?? it.unit_price_in_pack ?? 0);
    const qty   = Number(it.qty ?? 1);
    return sum + price * qty;
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
  return `${base}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
}

function formatPack(pack) {
  const items = (pack.pack_items ?? []).map(it => ({
    sku_id:     it.sku_id,
    name_fr:    it.sku?.article?.name_fr,
    name_ar:    it.sku?.article?.name_ar,
    sku_code:   it.sku?.article?.sku_code,
    qty:        Number(it.qty ?? 1),
    unit_price: Number(it.unit_price_in_pack ?? it.sku?.article?.price ?? 0),
    unit_label: it.sku?.article?.unit_sale ?? null, 
    image_url:  resolveImageUrl(it.sku?.article?.images?.[0]?.image_path),
  }));

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