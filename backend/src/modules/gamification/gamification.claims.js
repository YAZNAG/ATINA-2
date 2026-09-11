/**
 * Gamification — RÉCLAMATION DES LOTS « produit » (free_sku / free_pack) au checkout client.
 *
 * Règles (WF #9 « claimed_at / expires_at », US-082, US-110 bloc 7) :
 *  - seule une partie GAGNÉE du client connecté, dont le lot est de type free_sku ou
 *    free_pack, peut être réclamée ;
 *  - refus si le lot a déjà été réclamé (claimed_at renseigné), s'il est expiré
 *    (expires_at ≤ maintenant) ou s'il appartient à un autre client ;
 *  - le lot se réclame sur le node du jeu (stock, packs et prix sont définis par node) ;
 *  - à la confirmation : ligne(s) de commande à 0 MAD portant game_play_id, stock réservé
 *    (voir checkout.service.createOrder) et claimed_at renseigné par markClaimed (garde
 *    atomique contre la double réclamation) ;
 *  - annulation de la commande : order_lifecycle (bloc 7) remet claimed_at à NULL,
 *    expires_at = now() et awarded_count − 1.
 */
const prisma = require('../../config/database');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLAIMABLE_TYPES = ['free_sku', 'free_pack'];
const err = (statusCode, message) => ({ statusCode, message });

function normalizePlayIds(raw) {
  if (raw == null || raw === '') return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const ids = [];
  list.forEach((v, i) => {
    const id = String(v?.play_id ?? v ?? '').trim();
    if (!UUID_RE.test(id)) throw err(400, `claim_play_ids[${i}] : identifiant de partie invalide`);
    if (!ids.includes(id)) ids.push(id);
  });
  return ids;
}

const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { timeZone: 'Africa/Casablanca' });

/**
 * Contrôle les lots réclamés (sans rien écrire).
 * @returns {Promise<Array<{ play_id, type, sku_id, pack_id, name_fr, name_ar, game_name, expires_at }>>}
 */
async function validateClaims(db, { customer_id, node_id = null, claim_play_ids, now = new Date() }) {
  const ids = normalizePlayIds(claim_play_ids);
  if (!ids.length) return [];

  const plays = await db.gamificationPlay.findMany({
    where: { id: { in: ids } },
    include: {
      game: { select: { id: true, name_fr: true, node_id: true } },
      prize: {
        include: {
          prize_type: { select: { code: true } },
          sku: { select: { id: true, name_fr: true, name_ar: true, is_active: true, is_deleted: true } },
          pack: { select: { id: true, name_fr: true, name_ar: true, node_id: true, is_active: true, is_deleted: true } },
        },
      },
    },
  });
  const byId = Object.fromEntries(plays.map((p) => [p.id, p]));

  return ids.map((id) => {
    const play = byId[id];
    if (!play) throw err(404, 'Lot introuvable');
    if (play.customer_id !== customer_id) throw err(403, 'Ce lot appartient à un autre client');
    const type = play.prize?.prize_type?.code;
    if (play.result !== 'win' || !play.prize) throw err(422, "Cette partie n'a pas de lot à réclamer");
    const label = play.prize.name_fr || 'Lot';
    if (!CLAIMABLE_TYPES.includes(type)) throw err(422, `« ${label} » ne se réclame pas dans une commande`);
    if (play.claimed_at) throw err(409, `« ${label} » a déjà été réclamé`);
    if (play.expires_at && new Date(play.expires_at) <= now) {
      throw err(422, `« ${label} » a expiré le ${fmtDate(play.expires_at)} : il ne peut plus être réclamé`);
    }
    if (node_id && play.game?.node_id && play.game.node_id !== node_id) {
      throw err(422, `« ${label} » se réclame uniquement sur le magasin du jeu « ${play.game.name_fr} »`);
    }
    if (type === 'free_sku') {
      const sku = play.prize.sku;
      if (!sku || sku.is_deleted || !sku.is_active) throw err(422, `« ${label} » : produit indisponible`);
    } else {
      const pack = play.prize.pack;
      if (!pack || pack.is_deleted || !pack.is_active) throw err(422, `« ${label} » : pack indisponible`);
    }
    return {
      play_id: play.id,
      type,
      sku_id: type === 'free_sku' ? play.prize.sku_id : null,
      pack_id: type === 'free_pack' ? play.prize.pack_id : null,
      name_fr: type === 'free_sku' ? (play.prize.sku?.name_fr || label) : (play.prize.pack?.name_fr || label),
      name_ar: type === 'free_sku' ? play.prize.sku?.name_ar : play.prize.pack?.name_ar,
      prize_name_fr: label,
      game_name: play.game?.name_fr || null,
      expires_at: play.expires_at,
    };
  });
}

/**
 * Marque le lot réclamé (claimed_at = now) — garde atomique : échoue (409) si le lot
 * vient d'être réclamé ailleurs ou a expiré entre-temps.
 */
async function markClaimed(tx, { play_id, customer_id, now = new Date() }) {
  const res = await tx.gamificationPlay.updateMany({
    where: {
      id: play_id, customer_id, result: 'win', claimed_at: null,
      OR: [{ expires_at: null }, { expires_at: { gt: now } }],
    },
    data: { claimed_at: now },
  });
  if (res.count !== 1) throw err(409, 'Lot déjà réclamé ou expiré : recalculez votre panier');
  return now;
}

/** Aperçu non bloquant (calcul du panier) : { lines, error }. */
async function previewClaims(args) {
  try {
    return { lines: await validateClaims(args.db || prisma, args), error: null };
  } catch (e) {
    return { lines: [], error: e?.message || 'Lot non réclamable' };
  }
}

module.exports = { CLAIMABLE_TYPES, normalizePlayIds, validateClaims, markClaimed, previewClaims };
