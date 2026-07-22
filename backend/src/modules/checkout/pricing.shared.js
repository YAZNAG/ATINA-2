const prisma = require('../../config/database');
const { getActiveFlashSales, resolveArticleDiscount } = require('../flash_sale/article_discount');
const { getPackWithItems } = require('../pack/pack.shared');

async function resolveItemPrice(node_id, item) {
  if (item.pack_id) return resolvePackItemPrice(node_id, item.pack_id, item.sku_id);
  if (item.sku_id)  return resolveSkuPrice(node_id, item.sku_id);
  throw { statusCode: 400, message: 'cart_items: sku_id ou pack_id requis' };
}

async function resolveSkuPrice(node_id, sku_id) {
  const sku = await prisma.sku.findUnique({
    where:  { id: sku_id },
    select: {
      id: true,
      article: {
        select: {
          id: true, name_fr: true, price: true, vat_rate: true,
          category_id: true, brand_id: true,
          tax: { select: { rate: true } },
        },
      },
    },
  });
  if (!sku?.article) throw { statusCode: 404, message: `SKU introuvable: ${sku_id}` };

  const a = sku.article;
  const vatRate = Number(a.tax?.rate ?? a.vat_rate ?? 20);
  const priceHt = Number(a.price ?? 0);
  const basePriceTtc = Math.round(priceHt * (1 + vatRate / 100) * 100) / 100; 

  const flashSales = (await getActiveFlashSales()).filter(fs => !fs.node_id || fs.node_id === node_id);
  const discount = resolveArticleDiscount(
    { articleSkuId: sku_id, categoryId: a.category_id, brandId: a.brand_id, priceTtc: basePriceTtc },
    flashSales,
  );

  return {
    unit_price: discount ? discount.price_ttc : basePriceTtc,
    vat_rate:   vatRate,
    name_fr:    a.name_fr,
    source:     discount ? 'flash_sale' : 'catalog',
  };
}

// ── Prix d'une ligne SKU appartenant à un pack ───────────────────────────────
// Le panier envoie UNE ligne par SKU du pack (pas une ligne par pack) — on
// redistribue le prix total du pack proportionnellement, exactement comme
// l'affichage panier (voir customer_cart.service.getActivePackRatios).
async function resolvePackItemPrice(node_id, pack_id, sku_id) {
  if (!sku_id) throw { statusCode: 400, message: `pack_id ${pack_id}: sku_id requis pour un item de pack` };

  const now  = new Date();
  const pack = await getPackWithItems(pack_id);
  if (!pack || !pack.is_active || pack.is_deleted)
    throw { statusCode: 404, message: `Pack introuvable ou inactif: ${pack_id}` };
  if (pack.valid_from && new Date(pack.valid_from) > now) throw { statusCode: 422, message: `Pack pas encore disponible: ${pack_id}` };
  if (pack.valid_to   && new Date(pack.valid_to)   < now) throw { statusCode: 422, message: `Pack expiré: ${pack_id}` };

  const items  = pack.pack_items ?? [];
  const target = items.find(it => it.sku_id === sku_id);
  if (!target) throw { statusCode: 400, message: `SKU ${sku_id} n'appartient pas au pack ${pack_id}` };

  const total       = Number(pack.total_price ?? 0);
  const originalSum = items.reduce(
    (s, it) => s + Number(it.unit_price_in_pack ?? 0) * Number(it.qty ?? 1), 0,
  );

  const baseQty        = Number(target.qty ?? 1);
  const unitOriginal   = Number(target.unit_price_in_pack ?? 0);
  const lineOriginal   = unitOriginal * baseQty;
  const share          = originalSum > 0 ? lineOriginal / originalSum : 0;
  const lineDiscounted = Math.round(total * share * 100) / 100;
  const unitDiscounted = baseQty > 0 ? Math.round((lineDiscounted / baseQty) * 100) / 100 : unitOriginal;

  const vatRate = Number(target.sku?.article?.tax?.rate ?? target.sku?.article?.vat_rate ?? 20);

  return {
    unit_price: unitDiscounted,
    vat_rate:   vatRate,
    name_fr:    target.sku?.article?.name_fr ?? pack.name_fr,
    source:     `pack:${pack_id}`,
  };
}

module.exports = { resolveItemPrice, resolveSkuPrice, resolvePackItemPrice };