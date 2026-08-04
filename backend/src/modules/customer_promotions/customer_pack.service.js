const prisma = require('../../config/database');
const { PACK_INCLUDE, formatPack } = require('../pack/pack.shared');

async function listActivePacks() {
  const now = new Date();

  const packs = await prisma.pack.findMany({
    where: {
      is_active:  true,
      is_deleted: false,
      OR: [
        { valid_from: null },
        { valid_from: { lte: now } },
      ],
      AND: [
        { OR: [{ valid_to: null }, { valid_to: { gte: now } }] },
      ],
    },
    include: PACK_INCLUDE,
    orderBy: { created_at: 'desc' },
  });

  return packs.map(formatPack);
}

//deatail d'un pack
async function getPackById(id) {
  const pack = await prisma.pack.findFirst({
    where:   { id, is_active: true, is_deleted: false },
    include: PACK_INCLUDE,
  });
  if (!pack) throw { statusCode: 404, message: 'Pack introuvable' };
  return formatPack(pack);
}

//suggestions
async function listSimilarPacks(packId, limit = 6) {
  const now = new Date();

  const baseWhere = {
    is_active: true,
    is_deleted: false,
    OR: [{ valid_from: null }, { valid_from: { lte: now } }],
    AND: [{ OR: [{ valid_to: null }, { valid_to: { gte: now } }] }],
  };

  const CANDIDATE_POOL_LIMIT = 100; // sécurité perf : évite de charger des centaines de packs à chaque appel

  const [currentPack, candidates] = await Promise.all([
    prisma.pack.findFirst({
      where: { id: packId },
      include: PACK_INCLUDE,
    }),
    prisma.pack.findMany({
      where: { ...baseWhere, id: { not: packId } },
      include: PACK_INCLUDE,
      orderBy: { created_at: 'desc' },
      take: CANDIDATE_POOL_LIMIT,
    }),
  ]);

  if (!currentPack) return [];

  const getCategoryIds = (pack) =>
    new Set(
      (pack.pack_items ?? [])
        .map(pi => pi.sku?.article?.category_id)
        .filter(Boolean)
    );

  const currentCategoryIds = getCategoryIds(currentPack);

  // Fallback si le pack courant n'a aucune catégorie identifiable
  if (currentCategoryIds.size === 0) {
    return candidates.slice(0, limit).map(formatPack);
  }

  // Score = nombre de catégories en commun
  const scored = candidates.map(p => {
    const categoryIds = getCategoryIds(p);
    let overlap = 0;
    for (const catId of categoryIds) {
      if (currentCategoryIds.has(catId)) overlap++;
    }
    return { pack: p, overlap };
  });

  const similar = scored.filter(s => s.overlap > 0).sort((a, b) => b.overlap - a.overlap);
  const rest    = scored.filter(s => s.overlap === 0); // déjà triés par created_at desc via la requête

  const ranked = [...similar, ...rest].slice(0, limit).map(s => s.pack);

  return ranked.map(formatPack);
}

module.exports = { listActivePacks, getPackById, listSimilarPacks };