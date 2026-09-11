/**
 * Helpers partagés « app cliente » après la fusion articles → skus
 * (migration 20260822000622_merge_article_into_sku) :
 *  - nom / code / EAN / TVA / images portés directement par le SKU ;
 *  - prix de vente = selling_rules.price (TTC) du couple node × SKU (US-114) ;
 *  - image principale = sku_images non supprimées, is_primary DESC, sort_order ASC ;
 *  - garde-fou de disponibilité des packs (US-102).
 *
 * Utilisé par customer_cart, customer_checkout, customer_me et driver_portal.
 */
const prisma = require('../../config/database');
const { toPublicUrl } = require('../../utils/fileStorage');
const { applyDiscount } = require('../flash_sale/article_discount');
const { getPackSellableInfo } = require('../pack/pack.shared');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid  = (v) => typeof v === 'string' && UUID_RE.test(v);
const round2  = (n) => Math.round(Number(n || 0) * 100) / 100;

// ─── Images ──────────────────────────────────────────────────────────────────

/** Sélection Prisma de l'image principale d'un SKU. */
const PRIMARY_IMAGE_SELECT = {
  where:   { deleted_at: null },
  orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
  take:    1,
  select:  { url: true },
};

function primaryImageUrl(sku) {
  const url = sku?.images?.[0]?.url;
  return url ? toPublicUrl(url) : null;
}

// ─── Prix ────────────────────────────────────────────────────────────────────

const RULE_FIELDS = { node_id: true, price: true, is_sellable: true };

/** Sélection Prisma des règles de vente (limitée au node si connu). */
function sellingRulesSelect(nodeId) {
  return nodeId ? { where: { node_id: nodeId }, select: RULE_FIELDS } : { select: RULE_FIELDS };
}

function skuVatRate(sku) {
  return Number(sku?.tax?.rate ?? sku?.vat_rate ?? 20);
}

/**
 * Prix TTC d'un SKU sur un node :
 *  1. selling_rules.price du node (prix TTC saisi au back-office) ;
 *  2. node inconnu ou sans règle : plus petit prix des règles vendables (prix « à partir de ») ;
 *  3. repli historique : skus.price (HT) × (1 + TVA) ;
 *  4. sinon 0.
 * @returns {{ price_ttc:number, price_ht:number, vat_rate:number, is_sellable:boolean|null, source:string }}
 */
function resolveSkuPrice(sku, nodeId = null) {
  const vatRate = skuVatRate(sku);
  const rules   = sku?.selling_rules ?? [];
  const rule    = nodeId ? rules.find((r) => r.node_id === nodeId) : null;

  let priceTtc = null;
  let source   = 'none';
  if (rule && Number(rule.price) > 0) {
    priceTtc = round2(rule.price);
    source   = 'selling_rule';
  } else {
    const candidates = rules.filter((r) => r.is_sellable && Number(r.price) > 0).map((r) => Number(r.price));
    if (candidates.length) {
      priceTtc = round2(Math.min(...candidates));
      source   = 'selling_rule_min';
    } else if (sku?.price != null && Number(sku.price) > 0) {
      priceTtc = round2(Number(sku.price) * (1 + vatRate / 100));
      source   = 'sku_price';
    }
  }
  priceTtc = priceTtc ?? 0;

  return {
    price_ttc:   priceTtc,
    price_ht:    round2(priceTtc / (1 + vatRate / 100)),
    vat_rate:    vatRate,
    is_sellable: nodeId ? (rule ? !!rule.is_sellable : false) : null,
    source,
  };
}

// ─── Ventes flash ────────────────────────────────────────────────────────────

/** Ventes flash en cours (du node si connu) dont le quota n'est pas épuisé. */
async function getActiveFlashSales(nodeId = null) {
  const now  = new Date();
  const rows = await prisma.flashSale.findMany({
    where: {
      is_active: true, is_deleted: false,
      starts_at: { lte: now }, ends_at: { gte: now },
      ...(nodeId ? { node_id: nodeId } : {}),
    },
    select: {
      id: true, node_id: true, sku_id: true, pack_id: true, category_id: true, brand_id: true,
      discount_type: true, discount_value: true, flash_price: true, stock_flash: true, sold_count: true,
    },
  });
  return rows.filter((r) => r.stock_flash == null || r.sold_count < r.stock_flash);
}

/** Meilleur prix flash TTC applicable à un SKU (ciblage SKU, catégorie ou marque), null sinon. */
function bestSkuFlashPrice(sku, priceTtc, flashSales) {
  let best = null;
  for (const fs of flashSales) {
    if (fs.pack_id) continue;
    let candidate = null;
    if (fs.sku_id && fs.sku_id === sku.id) {
      candidate = fs.flash_price != null ? Number(fs.flash_price) : applyDiscount(priceTtc, fs.discount_type, fs.discount_value);
    } else if (!fs.sku_id && fs.category_id && fs.category_id === sku.category_id) {
      candidate = applyDiscount(priceTtc, fs.discount_type, fs.discount_value);
    } else if (!fs.sku_id && fs.brand_id && fs.brand_id === sku.brand_id) {
      candidate = applyDiscount(priceTtc, fs.discount_type, fs.discount_value);
    }
    if (candidate != null && candidate < priceTtc && (best === null || candidate < best)) best = candidate;
  }
  return best != null ? round2(best) : null;
}

// ─── Node du client ──────────────────────────────────────────────────────────

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Node utilisé pour tarifer le panier / les favoris (le panier n'a pas de node en base) :
 *  1. node explicite (?node_id=… ou en-tête X-Node-Id) s'il est actif ;
 *  2. node d'un pack présent dans le panier (un pack est rattaché à un node) ;
 *  3. node de la dernière commande du client ;
 *  4. node actif le plus proche de l'adresse par défaut (ou des coordonnées du client),
 *     ou l'unique node actif ;
 *  5. null (prix « à partir de »).
 */
async function resolveCustomerNodeId(customerId, { explicitNodeId = null, packNodeIds = [] } = {}) {
  const activeNode = (id) => prisma.node.findFirst({ where: { id, is_active: true, is_deleted: false }, select: { id: true } });

  if (isUuid(explicitNodeId) && await activeNode(explicitNodeId)) return explicitNodeId;

  const packNode = packNodeIds.find(Boolean);
  if (packNode) return packNode;

  const lastOrder = await prisma.order.findFirst({
    where:   { customer_id: customerId, is_deleted: false },
    orderBy: { created_at: 'desc' },
    select:  { node_id: true },
  });
  if (lastOrder?.node_id && await activeNode(lastOrder.node_id)) return lastOrder.node_id;

  const nodes = await prisma.node.findMany({
    where:  { is_active: true, is_deleted: false },
    select: { id: true, lat: true, lng: true },
  });
  if (!nodes.length) return null;
  if (nodes.length === 1) return nodes[0].id;

  const [address, customer] = await Promise.all([
    prisma.address.findFirst({
      where:  { customer_id: customerId, is_default: true, is_deleted: false },
      select: { lat: true, lng: true },
    }),
    prisma.customer.findUnique({ where: { id: customerId }, select: { lat: true, lng: true } }),
  ]);
  const ref = address?.lat != null && address?.lng != null ? address
    : customer?.lat != null && customer?.lng != null ? customer : null;
  if (!ref) return null;

  let best = null;
  for (const n of nodes) {
    if (n.lat == null || n.lng == null) continue;
    const d = haversineKm(Number(ref.lat), Number(ref.lng), Number(n.lat), Number(n.lng));
    if (!best || d < best.d) best = { id: n.id, d };
  }
  return best?.id ?? null;
}

// ─── Packs (US-102) ──────────────────────────────────────────────────────────

/**
 * Raison d'indisponibilité d'un pack chargé (null = disponible), sans requête.
 * `pack` doit contenir is_active, is_deleted, deleted_at, is_available, valid_from, valid_to.
 */
function packUnavailableReason(pack, now = new Date()) {
  if (!pack) return 'Pack introuvable';
  const label = `Le pack « ${pack.name_fr} »`;
  if (pack.is_deleted || pack.deleted_at) return `${label} a été supprimé : il n'est plus disponible à la vente.`;
  if (!pack.is_active) return `${label} est désactivé : il n'est plus disponible à la vente.`;
  if (pack.valid_from && new Date(pack.valid_from) > now) return `${label} n'est pas encore disponible.`;
  if (pack.valid_to && new Date(pack.valid_to) < now) return `${label} a expiré : il n'est plus disponible à la vente.`;
  if (pack.is_available === false) return `${label} est indisponible pour le moment (rupture de stock ou plafond de vente atteint).`;
  return null;
}

/**
 * Refuse (409) un pack indisponible : supprimé, inactif, hors période de validité,
 * packs.is_available = false, disponibilité read-time nulle ou quantité demandée
 * supérieure au nombre de packs vendables.
 * @param {string} packId
 * @param {number} requestedCount nombre total de packs visés (déjà au panier + ajout)
 */
async function assertPackAvailable(packId, requestedCount = 1) {
  if (!isUuid(packId)) throw { statusCode: 404, message: 'Pack introuvable' };
  const pack = await prisma.pack.findUnique({
    where:  { id: packId },
    select: {
      id: true, name_fr: true, node_id: true, is_active: true, is_deleted: true, deleted_at: true,
      is_available: true, valid_from: true, valid_to: true,
    },
  });
  if (!pack) throw { statusCode: 404, message: 'Pack introuvable' };

  const reason = packUnavailableReason(pack);
  if (reason) throw { statusCode: 409, message: reason };

  const info  = await getPackSellableInfo(packId);
  const label = `Le pack « ${pack.name_fr} »`;
  if (!info.is_available) {
    throw { statusCode: 409, message: `${label} est indisponible pour le moment (rupture de stock ou plafond de vente atteint).` };
  }
  if (info.vendable_count != null && requestedCount > info.vendable_count) {
    throw {
      statusCode: 409,
      message: `${label} : il ne reste que ${info.vendable_count} pack(s) disponible(s), ${requestedCount} demandé(s).`,
    };
  }
  return { pack, info };
}

module.exports = {
  isUuid, round2,
  PRIMARY_IMAGE_SELECT, primaryImageUrl,
  sellingRulesSelect, skuVatRate, resolveSkuPrice,
  getActiveFlashSales, bestSkuFlashPrice,
  resolveCustomerNodeId,
  packUnavailableReason, assertPackAvailable,
};
