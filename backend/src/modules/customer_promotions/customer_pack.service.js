const prisma = require('../../config/database');
const { PACK_INCLUDE, formatPack } = require('../pack/pack.shared');
const { applyDiscount } = require('../flash_sale/article_discount');
const { isUuid } = require('../customer_catalog/customer_node');

/*
 * Packs côté client (US-102) : un pack n'est proposé que s'il est actif, non supprimé,
 * dans sa période de validité et DISPONIBLE — flag matérialisé packs.is_available (trigger)
 * ET disponibilité recalculée à la lecture (computePackAvailability via formatPack).
 * Les packs sont rattachés à un node : on ne liste que ceux du node du client (ou sans node).
 * Une vente flash en cours ciblant le pack remplace son prix (comme au checkout).
 */

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const nodeIdOf = (ctx) => ctx?.node?.id ?? null;

function visibleWhere(extra = []) {
  const now = new Date();
  return {
    AND: [
      { is_active: true, is_deleted: false, deleted_at: null, is_available: true },
      { OR: [{ valid_from: null }, { valid_from: { lte: now } }] },
      { OR: [{ valid_to: null }, { valid_to: { gte: now } }] },
      ...extra,
    ],
  };
}

const nodeFilter = (nodeId) => (nodeId ? [{ OR: [{ node_id: null }, { node_id: nodeId }] }] : []);

/** Ventes flash en cours (quota restant) ciblant ces packs → Map(pack_id → vente la plus avantageuse). */
async function packFlashMap(packs) {
  if (!packs.length) return new Map();
  const now = new Date();
  const rows = await prisma.flashSale.findMany({
    where: {
      pack_id: { in: packs.map((p) => p.id) },
      is_active: true, is_deleted: false,
      starts_at: { lte: now }, ends_at: { gte: now },
    },
    select: {
      id: true, pack_id: true, node_id: true, flash_price: true, discount_type: true,
      discount_value: true, stock_flash: true, sold_count: true, ends_at: true,
    },
  });
  const byId = new Map(packs.map((p) => [p.id, p]));
  const map = new Map();
  for (const fs of rows) {
    if (fs.stock_flash != null && fs.sold_count >= fs.stock_flash) continue;
    const pack = byId.get(fs.pack_id);
    if (pack?.node_id && fs.node_id !== pack.node_id) continue;
    const base = Number(pack?.total_price ?? 0);
    const price = round2(fs.flash_price != null
      ? Number(fs.flash_price)
      : applyDiscount(base, fs.discount_type, fs.discount_value));
    if (!(price < base)) continue;
    const cur = map.get(fs.pack_id);
    if (!cur || price < cur.price) map.set(fs.pack_id, { price, fs });
  }
  return map;
}

function toClientPack(pack, flashMap) {
  const out = formatPack(pack);
  const flash = flashMap.get(pack.id);
  out.pack_price    = out.total_price;
  out.flash_sale_id = flash ? flash.fs.id : null;
  out.flash_ends_at = flash ? flash.fs.ends_at : null;
  if (flash) {
    out.total_price  = flash.price;
    out.saved_amount = round2(out.original_price - flash.price);
    out.discount_pct = out.original_price > 0 ? round2((1 - flash.price / out.original_price) * 100) : 0;
  }
  return out;
}

async function formatVisible(packs) {
  const flashMap = await packFlashMap(packs);
  return packs
    .map((p) => toClientPack(p, flashMap))
    .filter((p) => p.is_available); // disponibilité read-time (source de vérité)
}

async function listActivePacks(ctx = {}) {
  const packs = await prisma.pack.findMany({
    where:   visibleWhere(nodeFilter(nodeIdOf(ctx))),
    include: PACK_INCLUDE,
    orderBy: { created_at: 'desc' },
  });
  return formatVisible(packs);
}

// détail d'un pack
async function getPackById(id) {
  if (!isUuid(String(id))) throw { statusCode: 404, message: 'Pack introuvable' };
  const pack = await prisma.pack.findFirst({
    where:   visibleWhere([{ id: String(id) }]),
    include: PACK_INCLUDE,
  });
  const [formatted] = pack ? await formatVisible([pack]) : [];
  if (!formatted) throw { statusCode: 404, message: 'Pack introuvable ou indisponible' };
  return formatted;
}

// suggestions
async function listSimilarPacks(packId, limit = 6, ctx = {}) {
  if (!isUuid(String(packId))) return [];
  const max = Math.min(50, Math.max(1, parseInt(limit, 10) || 6));
  const CANDIDATE_POOL_LIMIT = 100; // sécurité perf

  const [currentPack, candidates] = await Promise.all([
    prisma.pack.findFirst({ where: { id: String(packId) }, include: PACK_INCLUDE }),
    prisma.pack.findMany({
      where:   visibleWhere([{ id: { not: String(packId) } }, ...nodeFilter(nodeIdOf(ctx))]),
      include: PACK_INCLUDE,
      orderBy: { created_at: 'desc' },
      take:    CANDIDATE_POOL_LIMIT,
    }),
  ]);
  if (!currentPack) return [];

  const visible = await formatVisible(candidates);
  const getCategoryIds = (pack) =>
    new Set((pack.pack_items ?? []).map((pi) => pi.sku?.category_id).filter(Boolean));

  const currentCategoryIds = getCategoryIds(currentPack);
  if (currentCategoryIds.size === 0) return visible.slice(0, max);

  const rawById = new Map(candidates.map((p) => [p.id, p]));
  const scored = visible.map((p) => {
    let overlap = 0;
    for (const catId of getCategoryIds(rawById.get(p.id))) if (currentCategoryIds.has(catId)) overlap++;
    return { pack: p, overlap };
  });
  const similar = scored.filter((s) => s.overlap > 0).sort((a, b) => b.overlap - a.overlap);
  const rest    = scored.filter((s) => s.overlap === 0); // déjà triés par created_at desc
  return [...similar, ...rest].slice(0, max).map((s) => s.pack);
}

module.exports = { listActivePacks, getPackById, listSimilarPacks };
