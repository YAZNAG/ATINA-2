const prisma = require('../../config/database');
const { recordPointsTxn, labelTagFilter } = require('./points-ledger.util');

/**
 * Moteur d'attribution à la livraison (WF#38 C / US-116 « CUMUL ») :
 *  - toutes les règles points_rules actives, non supprimées, valides à la date
 *    et applicables sont évaluées SÉPARÉMENT ;
 *  - une ligne points_transactions (type order_payment) par règle appliquée,
 *    référençant la règle ; le gain total est la somme des lignes ;
 *  - l'insertion des lignes et l'incrément de customers.points_balance se font
 *    dans la transaction `tx` fournie par l'appelant (passage à delivered).
 */

// Codes du classeur + anciens codes (compatibilité avec d'éventuelles règles historiques)
const RULE_CODE_ALIASES = {
  per_spend: 'per_spend', PURCHASE: 'per_spend',
  flat_bonus: 'flat_bonus', BONUS: 'flat_bonus',
  category_multiplier: 'category_multiplier',
  first_order: 'first_order', FIRST_ORDER: 'first_order',
};

const orderRef = (id) => `#${String(id).slice(0, 8).toUpperCase()}`;

async function loadApplicableRules(db, order, now = new Date()) {
  const total = Number(order.total_ttc ?? 0);
  const rules = await db.pointsRule.findMany({
    where: {
      is_active: true,
      is_deleted: false,
      valid_from: { lte: now },
      min_order_amount: { lte: total },
      AND: [
        { OR: [{ valid_to: null }, { valid_to: { gt: now } }] },
        { OR: [{ node_id: null }, { node_id: order.node_id ?? undefined }] },
      ],
    },
    include: { rule_type: { select: { code: true, name_fr: true } } },
    orderBy: { created_at: 'asc' },
  });
  return rules.filter((r) => RULE_CODE_ALIASES[r.rule_type?.code]);
}

/**
 * Calcule le gain de chaque règle applicable pour une commande.
 * @returns {Promise<Array<{ rule, code, points }>>}
 */
async function computeRuleGains(db, customer_id, order, now = new Date()) {
  if (!order || !customer_id) return [];
  const rules = await loadApplicableRules(db, order, now);
  if (!rules.length) return [];

  const total = Number(order.total_ttc ?? 0);
  const gains = [];
  let itemsCache = null;
  let firstOrderCache = null;

  for (const rule of rules) {
    const code = RULE_CODE_ALIASES[rule.rule_type.code];
    const value = Number(rule.points_value ?? 0);
    const perMad = Number(rule.per_mad_spent ?? 0);
    let points = 0;

    if (code === 'per_spend') {
      // points_value points pour chaque tranche de per_mad_spent MAD
      if (perMad > 0) points = Math.floor(total / perMad) * value;
    } else if (code === 'flat_bonus') {
      points = value;
    } else if (code === 'first_order') {
      if (firstOrderCache === null) {
        const prevDelivered = await db.order.count({
          where: { customer_id, is_deleted: false, status: { code: 'delivered' }, NOT: { id: order.id } },
        });
        firstOrderCache = prevDelivered === 0;
      }
      if (firstOrderCache) points = value;
    } else if (code === 'category_multiplier') {
      if (!rule.category_id) continue;
      if (itemsCache === null) {
        itemsCache = await db.orderItem.findMany({
          where: { order_id: order.id },
          select: { qty: true, unit_price_sold: true, discount_amount: true, sku: { select: { category_id: true } } },
        });
      }
      const lines = itemsCache.filter((i) => i.sku?.category_id === rule.category_id);
      if (!lines.length) continue;
      const catAmount = lines.reduce(
        (s, i) => s + Number(i.qty ?? 0) * Number(i.unit_price_sold ?? 0) - Number(i.discount_amount ?? 0), 0,
      );
      // Avec tranche : points_value par tranche de per_mad_spent MAD dépensés dans la catégorie ;
      // sans tranche : bonus fixe si la commande contient la catégorie.
      points = perMad > 0 ? Math.floor(Math.max(0, catAmount) / perMad) * value : value;
    }

    points = Math.max(0, Math.floor(points));
    if (points > 0) gains.push({ rule, code, points });
  }
  return gains;
}

/** Total des points que la commande rapporterait (compatibilité avec l'ancienne API). */
async function calculatePoints(customer_id, order) {
  const gains = await computeRuleGains(prisma, customer_id, order);
  return gains.reduce((s, g) => s + g.points, 0);
}

/**
 * Crédite les points d'une commande livrée, dans la transaction de livraison.
 * Idempotent : si la commande a déjà des lignes order_payment, rien n'est rejoué
 * (équivalent applicatif de l'index unique (order_id, points_rule_id)).
 */
async function creditPointsOnDelivery(tx, customer_id, order, deliveredStatusId) {
  if (!order?.id || !customer_id) return 0;
  if (Number(order.points_earned ?? 0) > 0) return 0;

  const already = await tx.pointsTransaction.count({
    where: { order_id: order.id, type: { in: ['order_payment', 'earn'] } },
  });
  if (already > 0) return 0;

  const gains = await computeRuleGains(tx, customer_id, order);
  if (!gains.length) return 0;

  let total = 0;
  for (const g of gains) {
    await recordPointsTxn(tx, {
      customer_id,
      amount: g.points,
      type: 'order_payment',
      reason: `Commande ${orderRef(order.id)} — ${g.rule.rule_type.name_fr}`,
      order_id: order.id,
      points_rule_id: g.rule.id,
    });
    total += g.points;
  }

  await tx.order.update({ where: { id: order.id }, data: { points_earned: total } });

  if (deliveredStatusId) {
    await tx.orderHistory.create({
      data: {
        order_id: order.id,
        status_id: deliveredStatusId,
        changed_by: null,
        note: `Points fidélité crédités : +${total} pts (${gains.length} règle${gains.length > 1 ? 's' : ''})`,
      },
    }).catch(() => {});
  }

  return total;
}

// ── Parrainage ────────────────────────────────────────────────────────────────

function randomCode(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i += 1) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}${s}`;
}

/** Attribue la récompense d'un bénéficiaire selon la configuration figée du parrainage. */
async function grantReferralReward(tx, { referral, config, beneficiary_id, role, now }) {
  const isReferrer = role === 'referrer';
  const typeCode = isReferrer ? config.referrer_type?.code : config.referee_type?.code;
  const value = Number(isReferrer ? config.referrer_reward_value : config.referee_reward_value);
  if (!(value > 0)) throw new Error(`Valeur de récompense ${role} invalide`);

  if (typeCode === 'points') {
    const dup = await tx.pointsTransaction.count({
      where: { customer_id: beneficiary_id, type: 'referral_reward', ...labelTagFilter('referral_id', referral.id) },
    });
    if (dup > 0) return null;
    return recordPointsTxn(tx, {
      customer_id: beneficiary_id,
      amount: Math.round(value),
      type: 'referral_reward',
      reason: isReferrer ? 'Parrainage — récompense parrain' : 'Parrainage — récompense filleul',
      referral_id: referral.id,
    });
  }

  if (typeCode === 'promo_code') {
    if (!config.promo_type_id) throw new Error('Type de promo manquant dans la configuration de parrainage');
    const dup = await tx.promotion.count({ where: { referral_id: referral.id, customer_id: beneficiary_id } });
    if (dup > 0) return null;
    const days = Number(config.promo_validity_days ?? 30) || 30;
    let code = randomCode('PAR');
    // eslint-disable-next-line no-await-in-loop
    for (let i = 0; i < 5 && (await tx.promotion.count({ where: { code } })) > 0; i += 1) code = randomCode('PAR');
    return tx.promotion.create({
      data: {
        promo_type_id: config.promo_type_id,
        code,
        value,
        min_order_amount: config.promo_min_order_amount ?? 0,
        uses_max: 1,
        uses_count: 0,
        uses_per_user_max: 1,
        is_combined: false,
        customer_id: beneficiary_id,
        referral_id: referral.id,
        valid_from: now,
        valid_to: new Date(now.getTime() + days * 24 * 3600 * 1000),
        is_active: true,
      },
    });
  }

  throw new Error(`Type de récompense de parrainage non supporté : ${typeCode}`);
}

/**
 * Valide le parrainage du filleul à la livraison de sa première commande
 * qualifiante (WF#6 B / US-084) : dans UNE transaction, passage à validated,
 * qualifying_order_id, validated_at et création des deux récompenses. Si une
 * attribution échoue, tout est annulé et le parrainage reste pending.
 */
async function validateReferralOnDelivery(customer_id, order_id) {
  try {
    const now = new Date();
    const order = await prisma.order.findUnique({
      where: { id: order_id },
      select: { id: true, total_ttc: true, customer_id: true, status: { select: { code: true } } },
    });
    if (!order || order.status?.code !== 'delivered') return;

    const referral = await prisma.referral.findFirst({
      where: { referee_id: customer_id, status: { code: 'pending' } },
      include: {
        config: {
          include: {
            referrer_type: { select: { code: true } },
            referee_type: { select: { code: true } },
          },
        },
      },
    });
    if (!referral || !referral.config) return;

    // La configuration appliquée est celle figée à l'inscription (config_id), active ou non aujourd'hui.
    const config = referral.config;
    if (Number(order.total_ttc ?? 0) < Number(config.min_order_amount ?? 0)) return;

    if (config.max_referrals_per_user) {
      const validatedCount = await prisma.referral.count({
        where: { referrer_id: referral.referrer_id, status: { code: 'validated' } },
      });
      if (validatedCount >= config.max_referrals_per_user) return;
    }

    const [pendingStatus, validatedStatus] = await Promise.all([
      prisma.referralStatus.findFirst({ where: { code: 'pending' } }),
      prisma.referralStatus.findFirst({ where: { code: 'validated' } }),
    ]);
    if (!pendingStatus || !validatedStatus) return;

    await prisma.$transaction(async (tx) => {
      const upd = await tx.referral.updateMany({
        where: { id: referral.id, status_id: pendingStatus.id },
        data: { status_id: validatedStatus.id, qualifying_order_id: order_id, validated_at: now },
      });
      if (upd.count === 0) return; // déjà traité (rejeu)

      await grantReferralReward(tx, { referral, config, beneficiary_id: referral.referrer_id, role: 'referrer', now });
      await grantReferralReward(tx, { referral, config, beneficiary_id: referral.referee_id, role: 'referee', now });
    });

    console.log(`[referral] validated: referral=${referral.id.slice(0, 8)} order=${String(order_id).slice(0, 8)}`);
  } catch (err) {
    // La validation du parrainage ne doit jamais casser le flux de livraison
    console.warn('[referral] validation error:', err.message);
  }
}

/**
 * Crée le parrainage (pending) à l'inscription avec un code valide :
 * config_id = configuration active au moment de l'inscription (obligatoire).
 * Renseigne aussi customers.referred_by_id (parrain unique du filleul).
 */
async function createReferralOnRegistration(referee_id, referral_code) {
  if (!referee_id || !referral_code) return;
  try {
    const referrer = await prisma.customer.findFirst({
      where: { referral_code, is_deleted: false, id: { not: referee_id } },
    });
    if (!referrer) return;

    const now = new Date();
    const [pendingStatus, config] = await Promise.all([
      prisma.referralStatus.findFirst({ where: { code: 'pending' } }),
      prisma.referralConfig.findFirst({
        where: {
          is_active: true,
          valid_from: { lte: now },
          OR: [{ valid_to: null }, { valid_to: { gt: now } }],
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);
    if (!pendingStatus) return;

    // Parrain unique du filleul (bloc « Parrain » de la fiche client)
    await prisma.customer.updateMany({
      where: { id: referee_id, referred_by_id: null },
      data: { referred_by_id: referrer.id },
    });

    if (!config) {
      console.warn('[referral] aucun programme de parrainage actif : parrainage non créé');
      return;
    }

    if (config.max_referrals_per_user) {
      const count = await prisma.referral.count({
        where: { referrer_id: referrer.id, status: { code: { in: ['pending', 'validated'] } } },
      });
      if (count >= config.max_referrals_per_user) {
        console.warn(`[referral] plafond de parrainages atteint pour ${referrer.id.slice(0, 8)}`);
        return;
      }
    }

    const alreadyReferred = await prisma.referral.findFirst({ where: { referee_id } });
    if (alreadyReferred) return;

    await prisma.referral.create({
      data: { referrer_id: referrer.id, referee_id, config_id: config.id, status_id: pendingStatus.id },
    });

    console.log(`[referral] pending created: referrer=${referrer.id.slice(0, 8)}, referee=${referee_id.slice(0, 8)}`);
  } catch (err) {
    console.warn('[referral] creation error:', err.message);
  }
}

module.exports = {
  calculatePoints,
  computeRuleGains,
  creditPointsOnDelivery,
  validateReferralOnDelivery,
  createReferralOnRegistration,
  grantReferralReward,
};
