const prisma = require('../../config/database');

async function getActiveFlashSales() {
  const now = new Date();
  return prisma.flashSale.findMany({
    where: { is_active: true, is_deleted: false, starts_at: { lte: now }, ends_at: { gte: now } },
    select: {
      sku_id: true, category_id: true, brand_id: true,
      discount_type: true, discount_value: true, flash_price: true,
    },
  });
}

function applyDiscount(priceTtc, discount_type, discount_value) {
  const val = parseFloat(discount_value ?? 0);
  const isPct = discount_type === 'percentage' || discount_type === 'pourcentage';
  if (isPct)                     return Math.round(priceTtc * (1 - val / 100) * 100) / 100;
  if (discount_type === 'fixed') return Math.max(0, Math.round((priceTtc - val) * 100) / 100);
  return priceTtc;
}

// Best (lowest) active discount for an article among sku/category/brand flash sales.
// `articleSkuId` is the Sku.id linked to the article (catalog_sku?.id), used to match sku-scoped sales.
function resolveArticleDiscount({ articleSkuId, categoryId, brandId, priceTtc }, flashSales) {
  let best = null;
  for (const fs of flashSales) {
    let candidate = null;
    if (fs.sku_id && articleSkuId && fs.sku_id === articleSkuId) {
      candidate = fs.flash_price != null
        ? Number(fs.flash_price)
        : applyDiscount(priceTtc, fs.discount_type, fs.discount_value);
    } else if (fs.category_id && fs.category_id === categoryId) {
      candidate = applyDiscount(priceTtc, fs.discount_type, fs.discount_value);
    } else if (fs.brand_id && fs.brand_id === brandId) {
      candidate = applyDiscount(priceTtc, fs.discount_type, fs.discount_value);
    }
    if (candidate != null && candidate < priceTtc && (best === null || candidate < best)) {
      best = candidate;
    }
  }
  if (best == null) return null;
  const pct = priceTtc > 0 ? Math.round((1 - best / priceTtc) * 100) : 0;
  return { price_ttc: best, old_price_ttc: priceTtc, discount_pct: pct };
}

module.exports = { getActiveFlashSales, applyDiscount, resolveArticleDiscount };
