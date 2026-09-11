const prisma = require('../../config/database');
const { applyDiscount } = require('../flash_sale/article_discount');
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
      name_fr: true,
      price: true,
      vat_rate: true,
      category_id: true,
      brand_id: true,
      tax: { select: { rate: true } },
      ...(node_id ? { selling_rules: { where: { node_id }, select: { price: true, is_sellable: true } } } : {}),
    },
  });
  if (!sku) throw { statusCode: 404, message: `SKU introuvable: ${sku_id}` };

  const a = sku; // plus de sku.article — tout est directement sur sku
  const vatRate = Number(a.tax?.rate ?? a.vat_rate ?? 20);
  // US-114 : le prix de vente est celui du node (selling_rules.price, saisi TTC).
  // Repli sur l'ancien prix catalogue HT (skus.price) pour les SKU sans règle de prix.
  const rule = a.selling_rules?.[0] || null;
  const basePriceTtc = rule && Number(rule.price) > 0
    ? Math.round(Number(rule.price) * 100) / 100
    : Math.round(Number(a.price ?? 0) * (1 + vatRate / 100) * 100) / 100;

  const flashSales = await getActiveFlashSalesForNode(node_id);
  const best = bestSkuFlash(flashSales, { sku_id, category_id: a.category_id, brand_id: a.brand_id, priceTtc: basePriceTtc });

  return {
    unit_price:    best ? best.price_ttc : basePriceTtc,
    vat_rate:      vatRate,
    name_fr:       a.name_fr,
    source:        best ? 'flash_sale' : 'catalog',
    flash_sale_id: best ? best.fs.id : null,
    flash_sale:    best ? best.fs : null,
  };
}

/**
 * Ventes flash EN COURS du node (node-scoped), dont le quota n'est pas épuisé
 * (stock_flash NULL = illimité, sinon sold_count < stock_flash).
 */
async function getActiveFlashSalesForNode(node_id) {
  const now = new Date();
  const rows = await prisma.flashSale.findMany({
    where: {
      is_active: true, is_deleted: false,
      starts_at: { lte: now }, ends_at: { gte: now },
      ...(node_id ? { node_id } : {}),
    },
    select: {
      id: true, name_fr: true, node_id: true, sku_id: true, pack_id: true, category_id: true, brand_id: true,
      discount_type: true, discount_value: true, flash_price: true,
      stock_flash: true, sold_count: true, max_qty_per_user: true,
    },
  });
  return rows.filter((r) => r.stock_flash == null || r.sold_count < r.stock_flash);
}

/** Meilleure vente flash applicable à un SKU (ciblage SKU, catégorie ou marque). */
function bestSkuFlash(flashSales, { sku_id, category_id, brand_id, priceTtc }) {
  let best = null;
  for (const fs of flashSales) {
    if (fs.pack_id) continue;
    let candidate = null;
    if (fs.sku_id && fs.sku_id === sku_id) {
      candidate = fs.flash_price != null ? Number(fs.flash_price) : applyDiscount(priceTtc, fs.discount_type, fs.discount_value);
    } else if (!fs.sku_id && fs.category_id && fs.category_id === category_id) {
      candidate = applyDiscount(priceTtc, fs.discount_type, fs.discount_value);
    } else if (!fs.sku_id && fs.brand_id && fs.brand_id === brand_id) {
      candidate = applyDiscount(priceTtc, fs.discount_type, fs.discount_value);
    }
    if (candidate != null && candidate < priceTtc && (!best || candidate < best.price_ttc)) {
      best = { price_ttc: Math.round(candidate * 100) / 100, fs };
    }
  }
  return best;
}

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

  // Vente flash ciblant ce pack (node du pack) : le prix flash remplace le prix du pack.
  const packFlash = (await getActiveFlashSalesForNode(pack.node_id || node_id)).find((fs) => fs.pack_id === pack_id) || null;
  const basePackTotal = Number(pack.total_price ?? 0);
  let total = basePackTotal;
  if (packFlash) {
    const f = packFlash.flash_price != null
      ? Number(packFlash.flash_price)
      : applyDiscount(basePackTotal, packFlash.discount_type, packFlash.discount_value);
    if (f < basePackTotal) total = f;
  }
  const appliedPackFlash = packFlash && total < basePackTotal ? packFlash : null;
  const originalSum = items.reduce(
    (s, it) => s + Number(it.unit_price_in_pack ?? 0) * Number(it.qty ?? 1), 0,
  );

  const baseQty        = Number(target.qty ?? 1);
  const unitOriginal   = Number(target.unit_price_in_pack ?? 0);
  const lineOriginal   = unitOriginal * baseQty;
  const share          = originalSum > 0 ? lineOriginal / originalSum : 0;
  const lineDiscounted = Math.round(total * share * 100) / 100;
  const unitDiscounted = baseQty > 0 ? Math.round((lineDiscounted / baseQty) * 100) / 100 : unitOriginal;

  const vatRate = Number(target.sku?.tax?.rate ?? target.sku?.vat_rate ?? target.sku?.article?.tax?.rate ?? 20);
  return {
    unit_price: unitDiscounted,
    vat_rate:   vatRate,
    name_fr:    target.sku?.name_fr ?? target.sku?.article?.name_fr ?? pack.name_fr,
    source:     appliedPackFlash ? `flash_sale:pack:${pack_id}` : `pack:${pack_id}`,
    flash_sale_id: appliedPackFlash ? appliedPackFlash.id : null,
    flash_sale:    appliedPackFlash,
    pack_discounted: Number(pack.original_price ?? 0) > basePackTotal,
  };
}

/**
 * Prix d'UN pack (ligne d'en-tête order_items : pack_id renseigné, sku_id NULL).
 * Prix = packs.total_price, remplacé par le prix flash si une vente flash du node cible le pack.
 * Renvoie aussi la recette (composants) et, pour la TVA, la contribution de chaque composant
 * au prix du pack (au prorata de unit_price_in_pack × qty) : la TVA de l'en-tête est la TVA
 * pondérée de ses composants. Les lignes composants sont stockées à 0 (aucun double comptage).
 */
async function resolvePackPrice(node_id, pack_id) {
  const now  = new Date();
  const pack = await getPackWithItems(pack_id);
  if (!pack || !pack.is_active || pack.is_deleted)
    throw { statusCode: 404, message: `Pack introuvable ou inactif: ${pack_id}` };
  if (pack.valid_from && new Date(pack.valid_from) > now) throw { statusCode: 422, message: `Le pack « ${pack.name_fr} » n'est pas encore disponible` };
  if (pack.valid_to   && new Date(pack.valid_to)   < now) throw { statusCode: 422, message: `Le pack « ${pack.name_fr} » est expiré` };
  const items = pack.pack_items ?? [];
  if (!items.length) throw { statusCode: 422, message: `Le pack « ${pack.name_fr} » n'a aucun composant` };

  const packFlash = (await getActiveFlashSalesForNode(pack.node_id || node_id)).find((fs) => fs.pack_id === pack_id) || null;
  const basePackTotal = Number(pack.total_price ?? 0);
  let total = basePackTotal;
  if (packFlash) {
    const f = packFlash.flash_price != null
      ? Number(packFlash.flash_price)
      : applyDiscount(basePackTotal, packFlash.discount_type, packFlash.discount_value);
    if (f < basePackTotal) total = f;
  }
  total = Math.round(total * 100) / 100;
  const appliedPackFlash = packFlash && total < basePackTotal ? packFlash : null;

  const originalSum = items.reduce((s, it) => s + Number(it.unit_price_in_pack ?? 0) * Number(it.qty ?? 1), 0);
  const qtySum = items.reduce((s, it) => s + Number(it.qty ?? 1), 0);
  let ht = 0;
  const components = items.map((it) => {
    const qty = Number(it.qty ?? 1);
    const share = originalSum > 0
      ? (Number(it.unit_price_in_pack ?? 0) * qty) / originalSum
      : (qtySum > 0 ? qty / qtySum : 0);
    const contribution = total * share; // part TTC du composant dans UN pack
    const vatRate = Number(it.sku?.tax?.rate ?? it.sku?.vat_rate ?? 20);
    ht += contribution / (1 + vatRate / 100);
    return {
      sku_id: it.sku_id,
      qty,
      name_fr: it.sku?.name_fr ?? pack.name_fr,
      vat_rate: vatRate,
      contribution_ttc: Math.round(contribution * 100) / 100,
    };
  });
  const vatRate = ht > 0 ? Math.round(((total / ht) - 1) * 10000) / 100 : 20;

  return {
    unit_price: total,
    unit_price_ht: ht,
    vat_rate: vatRate,
    name_fr: pack.name_fr,
    source: appliedPackFlash ? `flash_sale:pack:${pack_id}` : `pack:${pack_id}`,
    flash_sale_id: appliedPackFlash ? appliedPackFlash.id : null,
    flash_sale: appliedPackFlash,
    pack_discounted: Number(pack.original_price ?? 0) > basePackTotal,
    pack,
    components,
  };
}

module.exports = { resolveItemPrice, resolveSkuPrice, resolvePackItemPrice, resolvePackPrice, getActiveFlashSalesForNode };