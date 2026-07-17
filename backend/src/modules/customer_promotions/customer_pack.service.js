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
  const packs = await prisma.pack.findMany({
    where: {
      id: { not: packId },
      is_active: true,
      is_deleted: false,
      OR: [{ valid_from: null }, { valid_from: { lte: now } }],
      AND: [{ OR: [{ valid_to: null }, { valid_to: { gte: now } }] }],
    },
    include: PACK_INCLUDE,
    orderBy: { created_at: 'desc' },
    take: limit,
  });
  return packs.map(formatPack);
}

module.exports = { listActivePacks, getPackById, listSimilarPacks };