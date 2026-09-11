/**
 * Jeux — CÔTÉ CLIENT (app mobile) : section « Jeux » (WF #9, #15, #36 ; US-079 à US-082 ;
 * feuille « Gamification - Déblocage »).
 *
 *  - liste : jeux actifs du node du client, dans leur fenêtre, avec éligibilité calculée par
 *    engine.checkEligibility, badge « Votre tour est disponible ! » et message adapté à la
 *    condition et à la période ;
 *  - déclenchement des conditions (modèle « à la demande », sans tâche planifiée) :
 *      first_order     → la 1re commande non annulée du client (tous nodes) — elle doit être sur le node du jeu ;
 *      order_delivered → une commande LIVRÉE ET ENCAISSÉE sur le node du jeu, livrée pendant la période
 *                        en cours et après le début du jeu (aucun report d'une période à l'autre),
 *                        n'ayant pas encore débloqué de partie sur ce jeu, total ≥ seuil ;
 *      signup          → phone_verified_at pendant la fenêtre du jeu ;
 *      app_login       → l'appel lui-même (session client authentifiée) ;
 *  - jouer : engine.play (tirage, gain, points via recordPointsTxn, coupon nominatif, lot à réclamer) ;
 *  - « Mes gains » : points crédités, coupons générés (code, validité, utilisé ou non),
 *    produits / packs offerts à réclamer avant expires_at.
 */
const prisma = require('../../config/database');
const engine = require('../gamification/gamification.engine');
const R = require('../gamification/gamification.rules');
const { toPublicUrl } = require('../../utils/fileStorage');
const { resolveCustomerNodeId } = require('../customer_cart/customer_cart.shared');

const err = (statusCode, message) => ({ statusCode, message });
const NEEDS_ORDER = ['first_order', 'order_delivered'];

const RELOAD_MSG = {
  daily: 'Revenez demain pour un nouveau tour',
  weekly: 'Prochain tour lundi',
  monthly: 'Rechargement le 1er du mois',
  lifetime: 'Vous avez déjà utilisé votre tour',
};

const GAME_INCLUDE = {
  game_type: { select: { code: true, name_fr: true, name_ar: true } },
  unlock_condition: { select: { code: true, name_fr: true, name_ar: true } },
  play_period: { select: { code: true, name_fr: true, name_ar: true } },
  prizes: {
    where: { is_deleted: false },
    orderBy: { sort_order: 'asc' },
    select: {
      id: true, name_fr: true, name_ar: true, sort_order: true, is_active: true, stock_limit: true, awarded_count: true,
      prize_type: { select: { code: true } },
    },
  },
};

/** Commande candidate pour débloquer un jeu first_order / order_delivered (null sinon). */
async function findUnlockingOrder(customerId, game, now = new Date()) {
  const condition = game.unlock_condition?.code;
  if (condition === 'first_order') {
    const first = await prisma.order.findFirst({
      where: { customer_id: customerId, is_deleted: false, status: { code: { notIn: ['cancelled', 'returned'] } } },
      orderBy: { created_at: 'asc' },
      select: { id: true, node_id: true },
    });
    return first ? { id: first.id, other_node: !!game.node_id && first.node_id !== game.node_id } : null;
  }
  if (condition === 'order_delivered') {
    const start = await engine.periodStart(prisma, game.play_period?.code, now);
    const bound = start && new Date(start) > new Date(game.starts_at) ? new Date(start) : new Date(game.starts_at);
    const min = Number(game.unlock_min_amount || 0);
    const orders = await prisma.order.findMany({
      where: {
        customer_id: customerId, is_deleted: false,
        ...(game.node_id ? { node_id: game.node_id } : {}),
        status: { code: 'delivered' },
        OR: [{ cod_collected_at: { gte: bound } }, { cod_collected_at: null, updated_at: { gte: bound } }],
        ...(min > 0 ? { total_ttc: { gte: min } } : {}),
        gamification_plays: { none: { game_id: game.id } },
      },
      orderBy: { updated_at: 'desc' },
      take: 10,
      select: { id: true },
    });
    return orders[0] ? { id: orders[0].id, other_node: false } : null;
  }
  return null;
}

/** Message client selon la condition, la période et le résultat de l'éligibilité. */
function clientMessage(game, elig, candidate) {
  const condition = game.unlock_condition?.code;
  const period = game.play_period?.code;
  if (elig.eligible) {
    switch (condition) {
      case 'order_delivered': return 'Votre commande est bien livrée — votre tour vous attend !';
      case 'first_order': return 'Votre 1re commande vous offre un tour : jouez maintenant !';
      case 'signup': return 'Bienvenue ! Votre tour de bienvenue est disponible.';
      default: return 'Votre tour est disponible !';
    }
  }
  if (/Quota/i.test(elig.reason || '')) return RELOAD_MSG[period] || 'Quota de parties atteint';
  if (condition === 'order_delivered') {
    const min = Number(game.unlock_min_amount || 0);
    return min > 0
      ? `Commandez au moins ${min} MAD : votre tour sera débloqué à la livraison`
      : 'Votre tour sera débloqué à la livraison de votre commande';
  }
  if (condition === 'first_order') {
    return candidate ? 'Tour réservé à la première commande' : 'Votre 1re commande vous offre un tour';
  }
  if (condition === 'signup') return 'Vérifiez votre numéro de téléphone pour jouer';
  return elig.reason || 'Participation indisponible';
}

/**
 * Jeu masqué définitivement pour ce client (feuille Déblocage, scénario S2 :
 * « le jeu de bienvenue a disparu de son app ») : quota « à vie » consommé, 1re commande
 * passée sur un autre node, inscription antérieure au jeu.
 */
function isPermanentlyHidden(game, elig, candidate, customer) {
  const condition = game.unlock_condition?.code;
  if (elig.eligible) return false;
  if (game.play_period?.code === 'lifetime' && /Quota/i.test(elig.reason || '')) return true;
  if (condition === 'first_order' && candidate?.other_node) return true;
  if (condition === 'first_order' && candidate && /première commande/i.test(elig.reason || '')) return true;
  // signup : client déjà vérifié AVANT le lancement du jeu → le jeu ne le concerne pas
  if (condition === 'signup' && customer?.phone_verified_at
    && new Date(customer.phone_verified_at) < new Date(game.starts_at)) return true;
  return false;
}

function formatGame(game, elig, candidate) {
  const pool = game.prizes.filter((p) => p.is_active && !R.isExhausted(p));
  return {
    id: game.id,
    name_fr: game.name_fr,
    name_ar: game.name_ar,
    type: game.game_type?.code ?? null,
    type_label: game.game_type?.name_fr ?? null,
    condition: game.unlock_condition?.code ?? null,
    condition_label: game.unlock_condition?.name_fr ?? null,
    period: game.play_period?.code ?? null,
    period_label: game.play_period?.name_fr ?? null,
    max_plays_per_user: game.max_plays_per_user,
    unlock_min_amount: game.unlock_min_amount != null ? Number(game.unlock_min_amount) : null,
    starts_at: game.starts_at,
    ends_at: game.ends_at,
    prizes: pool.map((p) => ({ id: p.id, name_fr: p.name_fr, name_ar: p.name_ar, type: p.prize_type?.code, sort_order: p.sort_order })),
    can_play: !!elig.eligible,
    badge: !!elig.eligible,
    reason: elig.eligible ? null : elig.reason,
    message: clientMessage(game, elig, candidate),
    remaining: elig.remaining ?? null,
    plays_in_period: elig.playsInPeriod ?? null,
    order_id: elig.eligible && NEEDS_ORDER.includes(game.unlock_condition?.code) ? candidate?.id ?? null : null,
  };
}

async function activeGamesForNode(nodeId, now) {
  return prisma.gamificationGame.findMany({
    where: {
      is_deleted: false, is_active: true,
      ...(nodeId ? { OR: [{ node_id: nodeId }, { node_id: null }] } : { node_id: null }),
      starts_at: { lte: now },
      AND: [{ OR: [{ ends_at: null }, { ends_at: { gt: now } }] }],
    },
    include: GAME_INCLUDE,
    orderBy: [{ starts_at: 'desc' }],
  });
}

async function evaluate(customerId, game, now) {
  const candidate = NEEDS_ORDER.includes(game.unlock_condition?.code) ? await findUnlockingOrder(customerId, game, now) : null;
  let elig;
  try {
    elig = await engine.checkEligibility(customerId, game.id, { orderId: candidate?.id ?? null, now });
  } catch (e) {
    elig = { eligible: false, reason: e?.message || 'Participation indisponible' };
  }
  return { elig, candidate };
}

/** GET /customer/games?node_id= — jeux disponibles pour le client sur son node. */
async function listGames(customerId, { node_id = null } = {}) {
  const now = new Date();
  const nodeId = await resolveCustomerNodeId(customerId, { explicitNodeId: node_id });
  const [games, customer] = await Promise.all([
    activeGamesForNode(nodeId, now),
    prisma.customer.findUnique({ where: { id: customerId }, select: { phone_verified_at: true } }),
  ]);
  const out = [];
  for (const game of games) {
    const { elig, candidate } = await evaluate(customerId, game, now);
    if (isPermanentlyHidden(game, elig, candidate, customer)) continue;
    out.push(formatGame(game, elig, candidate));
  }
  const toClaim = await prisma.gamificationPlay.count({
    where: {
      customer_id: customerId, result: 'win', claimed_at: null, expires_at: { gt: now },
      prize: { prize_type: { code: { in: ['free_sku', 'free_pack'] } } },
    },
  });
  out.sort((a, b) => Number(b.can_play) - Number(a.can_play));
  return {
    node_id: nodeId,
    badge_count: out.filter((g) => g.can_play).length,
    prizes_to_claim: toClaim,
    games: out,
  };
}

/** POST /customer/games/:id/play — { order_id? } ; commande candidate trouvée automatiquement. */
async function playGame(customerId, gameId, { order_id = null } = {}) {
  R.uuid(gameId, 'Jeu', { required: true });
  const game = await prisma.gamificationGame.findFirst({ where: { id: gameId, is_deleted: false }, include: GAME_INCLUDE });
  if (!game) throw err(404, 'Jeu introuvable');
  let orderId = order_id || null;
  if (!orderId && NEEDS_ORDER.includes(game.unlock_condition?.code)) {
    const candidate = await findUnlockingOrder(customerId, game, new Date());
    orderId = candidate?.id ?? null;
    if (!orderId) {
      throw err(409, `Participation non accordée : ${clientMessage(game, { eligible: false, reason: null }, null)}`);
    }
  }
  const r = await engine.play(customerId, game.id, { orderId });
  const code = r.prize?.type ?? 'no_prize';
  const messages = {
    points: `Bravo ! ${r.reward?.points ?? ''} points ont été crédités sur votre compte.`,
    coupon: `Bravo ! Votre code promo ${r.reward?.code ?? ''} est disponible dans « Mes coupons ».`,
    free_sku: 'Bravo ! Votre produit offert est à réclamer dans votre prochaine commande.',
    free_pack: 'Bravo ! Votre pack offert est à réclamer dans votre prochaine commande.',
    no_prize: 'Pas de chance cette fois !',
  };
  return {
    play_id: r.play.id,
    result: r.play.result,
    played_at: r.play.played_at,
    prize: r.prize,
    reward: r.reward,
    expires_at: r.play.expires_at,
    remaining: r.remaining,
    message: messages[code] || messages.no_prize,
    reload_message: r.remaining === 0 ? RELOAD_MSG[game.play_period?.code] ?? null : null,
  };
}

/** GET /customer/games/prizes — « Mes gains ». */
async function myPrizes(customerId) {
  const now = new Date();
  const plays = await prisma.gamificationPlay.findMany({
    where: { customer_id: customerId, result: 'win', prize_id: { not: null } },
    orderBy: { played_at: 'desc' },
    take: 200,
    include: {
      game: { select: { id: true, name_fr: true, name_ar: true, node_id: true, game_type: { select: { code: true } } } },
      prize: {
        select: {
          id: true, name_fr: true, name_ar: true, value: true, sku_id: true, pack_id: true,
          prize_type: { select: { code: true } },
          sku: {
            select: {
              id: true, name_fr: true, name_ar: true,
              images: { where: { deleted_at: null }, orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }], take: 1, select: { url: true } },
            },
          },
          pack: { select: { id: true, name_fr: true, name_ar: true, image_url: true } },
        },
      },
    },
  });
  const ids = plays.map((p) => p.id);
  const [txns, promos, items] = ids.length ? await Promise.all([
    prisma.pointsTransaction.findMany({ where: { game_play_id: { in: ids } }, select: { game_play_id: true, points: true, created_at: true } }),
    prisma.promotion.findMany({
      where: { play_id: { in: ids }, customer_id: customerId },
      select: {
        id: true, play_id: true, code: true, value: true, min_order_amount: true, valid_from: true, valid_to: true,
        uses_count: true, uses_max: true, is_active: true, promo_type: { select: { code: true } },
      },
    }),
    prisma.orderItem.findMany({
      where: { game_play_id: { in: ids } },
      select: { game_play_id: true, order_id: true, status: { select: { code: true } } },
    }),
  ]) : [[], [], []];
  const txnBy = Object.fromEntries(txns.map((t) => [t.game_play_id, t]));
  const promoBy = Object.fromEntries(promos.map((p) => [p.play_id, p]));
  const itemBy = {};
  for (const it of items) if (it.status?.code !== 'cancelled') itemBy[it.game_play_id] = it;

  const points = [];
  const coupons = [];
  const to_claim = [];
  for (const p of plays) {
    const type = p.prize?.prize_type?.code;
    const base = {
      play_id: p.id, played_at: p.played_at,
      game: { id: p.game?.id, name_fr: p.game?.name_fr, name_ar: p.game?.name_ar, type: p.game?.game_type?.code },
      prize_name_fr: p.prize?.name_fr, prize_name_ar: p.prize?.name_ar,
    };
    if (type === 'points') {
      points.push({ ...base, points: txnBy[p.id]?.points ?? Math.round(Number(p.prize?.value ?? 0)), credited_at: txnBy[p.id]?.created_at ?? p.claimed_at });
    } else if (type === 'coupon') {
      const c = promoBy[p.id];
      const used = !!c && c.uses_max != null && c.uses_count >= c.uses_max;
      const expired = !!c && new Date(c.valid_to) < now;
      coupons.push({
        ...base,
        code: c?.code ?? null,
        promo_type: c?.promo_type?.code ?? null,
        value: c ? Number(c.value) : null,
        min_order_amount: c ? Number(c.min_order_amount ?? 0) : 0,
        valid_from: c?.valid_from ?? null,
        valid_to: c?.valid_to ?? p.expires_at,
        status: !c ? 'unavailable' : used ? 'used' : expired ? 'expired' : c.is_active ? 'available' : 'unavailable',
      });
    } else if (type === 'free_sku' || type === 'free_pack') {
      const status = R.claimStatus(p, now);
      const isSku = type === 'free_sku';
      to_claim.push({
        ...base,
        type,
        sku_id: isSku ? p.prize.sku_id : null,
        pack_id: isSku ? null : p.prize.pack_id,
        name_fr: isSku ? p.prize.sku?.name_fr : p.prize.pack?.name_fr,
        name_ar: isSku ? p.prize.sku?.name_ar : p.prize.pack?.name_ar,
        image_url: toPublicUrl(isSku ? p.prize.sku?.images?.[0]?.url : p.prize.pack?.image_url) ?? null,
        node_id: p.game?.node_id ?? null,
        expires_at: p.expires_at,
        claimed_at: p.claimed_at,
        status,
        order_id: itemBy[p.id]?.order_id ?? null,
      });
    }
  }
  return {
    summary: {
      points_total: points.reduce((s, x) => s + Number(x.points || 0), 0),
      coupons_available: coupons.filter((c) => c.status === 'available').length,
      prizes_to_claim: to_claim.filter((c) => c.status === 'pending').length,
    },
    points,
    coupons,
    to_claim,
  };
}

/**
 * Jeux débloqués par une commande qui vient d'être livrée et encaissée (order_delivered /
 * first_order) — utilitaire pour une notification « votre tour vous attend » depuis les
 * flux de livraison (delivery_mgmt, pickup, orders_mgmt). Lecture seule.
 */
async function gamesUnlockedByOrder(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, customer_id: true, node_id: true } });
  if (!order) return [];
  const now = new Date();
  const games = (await activeGamesForNode(order.node_id, now))
    .filter((g) => NEEDS_ORDER.includes(g.unlock_condition?.code));
  const out = [];
  for (const g of games) {
    const e = await engine.checkEligibility(order.customer_id, g.id, { orderId: order.id, now }).catch(() => null);
    if (e?.eligible) out.push({ game_id: g.id, name_fr: g.name_fr, name_ar: g.name_ar });
  }
  return out;
}

module.exports = { listGames, playGame, myPrizes, findUnlockingOrder, gamesUnlockedByOrder };
