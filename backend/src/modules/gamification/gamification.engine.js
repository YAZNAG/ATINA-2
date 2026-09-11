/**
 * Gamification — MOTEUR DE JEU (côté app client). NON BRANCHÉ sur les routes :
 * le déclenchement (jouer / réclamer) relève de l'app mobile et d'un futur
 * module customer_gamification. Ce service est prêt à être appelé depuis une
 * route client authentifiée (customer_auth.middleware) :
 *
 *   const engine = require('../gamification/gamification.engine');
 *   // app_login / signup : aucune commande
 *   const r = await engine.play(req.customer.id, gameId);
 *   // first_order / order_delivered : commande qui débloque la partie
 *   const r = await engine.play(req.customer.id, gameId, { orderId });
 *
 * Règles appliquées (feuille « Gamification - Déblocage », US-079 à US-082) :
 *  - jeu actif, non supprimé, dans sa fenêtre starts_at ≤ maintenant < ends_at ;
 *  - condition de déblocage évaluée par R.evaluateUnlock (cas T01–T18) :
 *      first_order     → la commande est la 1re commande non annulée du client, sur le node du jeu ;
 *      order_delivered → commande LIVRÉE ET ENCAISSÉE (COD) sur le node du jeu, total_ttc ≥ seuil
 *                        (inclusif, 0/NULL = aucun seuil) ; une commande ne débloque qu'une partie par jeu ;
 *      signup          → numéro vérifié par OTP (phone_verified_at) pendant la fenêtre du jeu
 *                        (les clients déjà inscrits ne déclenchent rien) ;
 *      app_login       → session authentifiée au premier plan (l'appel lui-même) ;
 *  - quota max_plays_per_user compté sur played_at dans la période en cours
 *    (Africa/Casablanca, semaine commençant le lundi ; lifetime = sans remise à zéro) ;
 *    une partie perdue consomme le quota ; aucune participation n'est reportée ;
 *  - tirage pondéré parmi les lots actifs non épuisés ; no_prize → result = lose, prize_id NULL ;
 *  - gain : awarded_count + 1 (désactivation automatique à stock_limit) ;
 *      points    → points_transactions (type prize_award, append-only) + solde client, réclamé immédiatement ;
 *      coupon    → code promo nominatif (is_gamification, customer_id, play_id, uses_max 1,
 *                  uses_count 0, is_combined false, uses_per_user_max 1, valid_to = gain + coupon_validity_days) ;
 *      free_sku / free_pack → à réclamer dans l'app avant expires_at (ligne de commande créée à la réclamation,
 *                  hors périmètre de ce service).
 * game_plays est APPEND-ONLY fonctionnellement : ce service n'insère que des lignes.
 */
const crypto = require('crypto');
const prisma = require('../../config/database');
const R = require('./gamification.rules');

const { bad } = R;
const CLAIM_DAYS = Math.max(1, parseInt(process.env.GAMIFICATION_CLAIM_DAYS, 10) || 7);

/** Début de la période en cours (Africa/Casablanca) ; null pour lifetime. */
async function periodStart(tx, periodCode, now) {
  const unit = { daily: 'day', weekly: 'week', monthly: 'month' }[periodCode];
  if (!unit) return null;
  const [row] = await tx.$queryRaw`
    SELECT (date_trunc(${unit}, (${now}::timestamptz) AT TIME ZONE ${R.TZ}) AT TIME ZONE ${R.TZ}) AS start`;
  return row.start;
}

async function loadGame(tx, gameId) {
  const id = R.uuid(gameId, 'Jeu', { required: true });
  const game = await tx.gamificationGame.findFirst({
    where: { id, is_deleted: false },
    include: {
      unlock_condition: { select: { code: true } },
      play_period: { select: { code: true } },
      prizes: { include: { prize_type: { select: { code: true } } } },
    },
  });
  if (!game) throw bad('Jeu introuvable', 404);
  return game;
}

/**
 * Rassemble les faits et évalue le déblocage (sans rien écrire).
 * @returns {Promise<{ eligible, reason, remaining, playsInPeriod, periodStart, game }>}
 */
async function checkEligibility(customerId, gameId, { orderId = null, now = new Date(), tx = prisma } = {}) {
  const game = await loadGame(tx, gameId);
  const condition = game.unlock_condition?.code;
  const period = game.play_period?.code;
  const res = (eligible, reason, extra = {}) => ({ eligible, reason, game, ...extra });

  if (!game.is_active) return res(false, 'Jeu inactif');
  if (new Date(game.starts_at) > now) return res(false, 'Jeu pas encore commencé');
  if (game.ends_at && new Date(game.ends_at) <= now) return res(false, 'Jeu terminé');

  const customer = await tx.customer.findFirst({
    where: { id: R.uuid(customerId, 'Client', { required: true }), is_deleted: false },
    select: { id: true, is_active: true, phone_verified_at: true },
  });
  if (!customer || !customer.is_active) return res(false, 'Client introuvable ou bloqué');

  const facts = {
    condition,
    period,
    minAmount: R.toNumOrNull(game.unlock_min_amount),
    maxPlays: game.max_plays_per_user,
    eventObserved: false,
    orderAmount: 0,
    orderRank: 0,
  };

  let order = null;
  if (R.CONDITION_RULES[condition]?.needsOrder) {
    if (!orderId) return res(false, 'Commande requise pour ce jeu');
    order = await tx.order.findFirst({
      where: { id: R.uuid(orderId, 'Commande', { required: true }), customer_id: customer.id, is_deleted: false },
      include: { status: { select: { code: true } }, payments: { include: { status: { select: { code: true } } } } },
    });
    if (!order) return res(false, 'Commande introuvable pour ce client');
    if (order.node_id !== game.node_id) return res(false, 'La commande n’a pas été passée sur le node du jeu');
    facts.orderAmount = Number(order.total_ttc);
    if (condition === 'first_order') {
      if (['cancelled', 'returned'].includes(order.status.code)) return res(false, 'Commande annulée');
      const before = await tx.order.count({
        where: {
          customer_id: customer.id, is_deleted: false, id: { not: order.id },
          created_at: { lt: order.created_at },
          status: { code: { notIn: ['cancelled', 'returned'] } },
        },
      });
      facts.orderRank = before + 1;
    } else {
      const collected = !!order.cod_collected_at || order.payments.some((p) => p.status?.code === 'collected');
      facts.eventObserved = order.status.code === 'delivered' && collected;
      const already = await tx.gamificationPlay.count({ where: { game_id: game.id, order_id: order.id } });
      if (already > 0) return res(false, 'Cette commande a déjà débloqué une participation sur ce jeu');
    }
  } else if (condition === 'signup') {
    facts.eventObserved = !!customer.phone_verified_at && new Date(customer.phone_verified_at) >= new Date(game.starts_at);
  } else if (condition === 'app_login') {
    facts.eventObserved = true; // l'appel est fait depuis une session client authentifiée
  }

  const start = await periodStart(tx, period, now);
  const playsInPeriod = await tx.gamificationPlay.count({
    where: { customer_id: customer.id, game_id: game.id, ...(start ? { played_at: { gte: start } } : {}) },
  });
  facts.playsInPeriod = playsInPeriod;
  const ev = R.evaluateUnlock(facts);
  return res(ev.granted, ev.reason, { remaining: ev.remaining, playsInPeriod, periodStart: start, order });
}

function randomCode(prefix) {
  return `${prefix}-${crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 8)}`;
}

/**
 * Joue une partie pour un client. Transactionnel, protégé contre les appels
 * concurrents (verrou consultatif par client × jeu).
 * @returns {Promise<{ play, prize, reward, remaining }>}
 */
async function play(customerId, gameId, { orderId = null, now = new Date(), rng = Math.random } = {}) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${String(customerId) + ':' + String(gameId)}))`;
    const elig = await checkEligibility(customerId, gameId, { orderId, now, tx });
    if (!elig.eligible) throw bad(`Participation non accordée : ${elig.reason}`, 409);
    const { game } = elig;

    // Tirage parmi les lots actifs non épuisés (re-tirage si un plafond est atteint en concurrence).
    let pool = game.prizes.filter((p) => p.is_active && !R.isExhausted(p));
    if (pool.length === 0) throw bad('Aucun lot disponible pour ce jeu', 409);
    let prize = null;
    while (pool.length) {
      const pick = R.weightedPick(pool, rng);
      if (!pick) break;
      if (pick.prize_type.code === 'no_prize') { prize = pick; break; }
      const updated = await tx.$queryRaw`
        UPDATE gamification_prizes
           SET awarded_count = awarded_count + 1,
               is_active = CASE WHEN stock_limit IS NOT NULL AND awarded_count + 1 >= stock_limit THEN false ELSE is_active END
         WHERE id = ${pick.id}::uuid AND is_active = true
           AND (stock_limit IS NULL OR awarded_count < stock_limit)
        RETURNING id`;
      if (updated.length) { prize = pick; break; }
      pool = pool.filter((p) => p.id !== pick.id);
    }
    if (!prize) throw bad('Aucun lot disponible pour ce jeu', 409);

    const code = prize.prize_type.code;
    const win = code !== 'no_prize';
    const addDays = (d) => new Date(now.getTime() + d * 86400000);
    let claimed_at = null;
    let expires_at = null;
    if (code === 'points') claimed_at = now;
    if (code === 'coupon') { claimed_at = now; expires_at = addDays(prize.coupon_validity_days); }
    if (code === 'free_sku' || code === 'free_pack') expires_at = addDays(CLAIM_DAYS);

    const playRow = await tx.gamificationPlay.create({
      data: {
        customer_id: customerId,
        game_id: game.id,
        prize_id: win ? prize.id : null,
        order_id: elig.order?.id ?? null,
        result: win ? 'win' : 'lose',
        played_at: now,
        claimed_at,
        expires_at,
      },
    });

    let reward = null;
    if (code === 'points') {
      const points = Math.round(Number(prize.value));
      const c = await tx.customer.update({
        where: { id: customerId },
        data: { points_balance: { increment: points }, points_lifetime: { increment: points } },
        select: { points_balance: true },
      });
      await tx.pointsTransaction.create({
        data: {
          customer_id: customerId,
          order_id: elig.order?.id ?? null,
          type: 'prize_award',
          points,
          balance_after: c.points_balance,
          label: `Partie ${playRow.id} — ${game.name_fr}`.slice(0, 255),
        },
      });
      reward = { type: 'points', points, balance_after: c.points_balance };
    } else if (code === 'coupon') {
      let promo = null;
      for (let i = 0; i < 5 && !promo; i += 1) {
        const candidate = randomCode(prize.coupon_code_prefix || 'GAME');
        const exists = await tx.promotion.findUnique({ where: { code: candidate }, select: { id: true } });
        if (exists) continue;
        promo = await tx.promotion.create({
          data: {
            code: candidate,
            node_id: game.node_id,
            promo_type_id: prize.coupon_promo_type_id,
            value: prize.value,
            min_order_amount: prize.coupon_min_order_amount,
            uses_max: 1,
            uses_count: 0,
            uses_per_user_max: 1,
            is_combined: false,
            is_gamification: true,
            customer_id: customerId,
            play_id: playRow.id,
            valid_from: now,
            valid_to: expires_at,
            is_active: true,
          },
        });
      }
      if (!promo) throw bad('Génération du code promo impossible, réessayez', 500);
      reward = { type: 'coupon', code: promo.code, valid_to: promo.valid_to };
    } else if (win) {
      reward = { type: code, sku_id: prize.sku_id, pack_id: prize.pack_id, claim_before: expires_at };
    }

    return {
      play: playRow,
      prize: win ? { id: prize.id, name_fr: prize.name_fr, name_ar: prize.name_ar, type: code } : null,
      reward,
      remaining: elig.remaining,
    };
  });
}

module.exports = { checkEligibility, play, periodStart };
