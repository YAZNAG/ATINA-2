const prisma = require('../../config/database');
const { creditReward } = require('./reward-credit.util');

async function creditPointsOnDelivery(tx, customer_id, order, deliveredStatusId) {
  if (Number(order.points_earned ?? 0) > 0) return 0;

  const points = await calculatePoints(customer_id, order);
  if (points <= 0) return 0;

  const customer = await tx.customer.update({
    where: { id: customer_id },
    data:  { points_balance: { increment: points }, points_lifetime: { increment: points } },
  });

  await tx.order.update({ where: { id: order.id }, data: { points_earned: points } });

  await tx.pointsTransaction.create({
    data: {
      customer_id,
      order_id:      order.id,
      type:          'earn',
      points,
      balance_after: customer.points_balance,
      label:         `Commande #${order.id.slice(0, 6).toUpperCase()}`,
    },
  });

  if (deliveredStatusId) {
    await tx.orderHistory.create({
      data: { order_id: order.id, status_id: deliveredStatusId, changed_by: null, note: `Points fidélité crédités : +${points} pts` },
    }).catch(() => {});
  }

  return points;
}

// ── Points Rules Engine 

async function calculatePoints(customer_id, order) {
  if (!order || !customer_id) return 0;

  const now   = new Date();
  const total = Number(order.total_ttc ?? 0);

  // Load active gain rules
  const rules = await prisma.pointsRule.findMany({
    where: {
      is_active:  true,
      valid_from: { lte: now },
      AND: [
        { OR: [{ valid_to: null }, { valid_to: { gte: now } }] },
        { OR: [{ node_id: null }, { node_id: order.node_id }] },
      ],
      min_order_amount: { lte: total },
      rule_type: { code: { in: ['PURCHASE', 'BONUS', 'FIRST_ORDER'] } },
    },
    include: { rule_type: { select: { code: true } } },
    orderBy: { created_at: 'asc' },
  });

  if (!rules.length) {
    // 1 point per 10 MAD if no rules configured
    return Math.max(0, Math.floor(total / 10));
  }

  let totalPoints = 0;
  let firstOrderChecked = false;

  for (const rule of rules) {
    const code = rule.rule_type?.code;

    if (code === 'PURCHASE') {
      const rate = Number(rule.per_mad_spent ?? 10);
      totalPoints += Math.floor(total / rate) * rule.points_value;

    } else if (code === 'BONUS') {
      totalPoints += rule.points_value;

    } else if (code === 'FIRST_ORDER' && !firstOrderChecked) {
      firstOrderChecked = true;
      const prevDelivered = await prisma.order.count({
        where: { customer_id, is_deleted: false, status: { code: 'delivered' }, NOT: { id: order.id } },
      });
      if (prevDelivered === 0) totalPoints += rule.points_value;
    }
  }

  return Math.max(0, totalPoints);
}

// ── Referral validation ───────────────────────────────────────────────────────

async function validateReferralOnDelivery(customer_id, order_id) {
  try {
    const now   = new Date();
    const order = await prisma.order.findUnique({ where: { id: order_id }, select: { id: true, total_ttc: true, customer_id: true, status: { select: { code: true } } } });
    if (!order || order.status?.code !== 'delivered') return;

    // Find pending referral where this customer is the referee
    const referral = await prisma.referral.findFirst({
      where: { referee_id: customer_id, status: { code: 'pending' } },
      include: {
        config: {
          include: {
            referrer_type: { select: { code: true } },
            referee_type:  { select: { code: true } },
          },
        },
        status: true,
      },
    });
    if (!referral) return;

    const config = referral.config;
    if (!config || !config.is_active) return;
    if (config.valid_from > now) return;
    if (config.valid_to && config.valid_to < now) return;

    const total = Number(order.total_ttc ?? 0);
    if (total < Number(config.min_order_amount ?? 0)) return;

    // Check referral limit for referrer
    if (config.max_referrals_per_user) {
      const validatedCount = await prisma.referral.count({
        where: { referrer_id: referral.referrer_id, status: { code: 'validated' } },
      });
      if (validatedCount >= config.max_referrals_per_user) return;
    }

    const [validatedStatus, walletTxnType] = await Promise.all([
      prisma.referralStatus.findFirst({ where: { code: 'validated' } }),
      prisma.walletTxnType.findFirst({ where: { code: 'referral_reward' } }),
    ]);
    if (!validatedStatus) return;

    await prisma.$transaction(async (tx) => {
      // Update referral status
      await tx.referral.update({
        where: { id: referral.id },
        data: {
          status_id:           validatedStatus.id,
          qualifying_order_id: order_id,
          reward_amount:       config.referrer_reward_value,
          validated_at:        now,
        },
      });

      // Credit REFERRER
      await creditReward(tx, referral.referrer_id, config.referrer_type?.code, config.referrer_reward_value, walletTxnType, `Bonus parrainage — ${referral.referee_id.slice(0, 8)}`);

      // Credit REFEREE
      await creditReward(tx, referral.referee_id, config.referee_type?.code, config.referee_reward_value, walletTxnType, 'Bienvenue — bonus filleul');
    });

    console.log(`[referral] validated: referrer=${referral.referrer_id.slice(0,8)}, referee=${customer_id.slice(0,8)}`);
  } catch (err) {
    // Referral validation must never break main delivery flow
    console.warn('[referral] validation error:', err.message);
  }
}

// ── Create referral on customer registration ──────────────────────────────────

async function createReferralOnRegistration(referee_id, referral_code) {
  if (!referee_id || !referral_code) return;
  try {
    const referrer = await prisma.customer.findFirst({
      where: { referral_code, is_deleted: false, id: { not: referee_id } },
    });
    if (!referrer) return;

    const pendingStatus = await prisma.referralStatus.findFirst({ where: { code: 'pending' } });
    if (!pendingStatus) return;

    // Find the best active config (newest)
    const config = await prisma.referralConfig.findFirst({
      where: {
        is_active: true,
        valid_from: { lte: new Date() },
        OR: [{ valid_to: null }, { valid_to: { gte: new Date() } }],
      },
      orderBy: { created_at: 'desc' },
    });

    const existing = await prisma.referral.findUnique({ where: { referrer_id_referee_id: { referrer_id: referrer.id, referee_id } } });
    if (existing) return;

    await prisma.referral.create({
      data: { referrer_id: referrer.id, referee_id, config_id: config?.id ?? null, status_id: pendingStatus.id },
    });

    console.log(`[referral] pending created: referrer=${referrer.id.slice(0,8)}, referee=${referee_id.slice(0,8)}`);
  } catch (err) {
    console.warn('[referral] creation error:', err.message);
  }
}

module.exports = {
  calculatePoints,
  creditPointsOnDelivery,
  validateReferralOnDelivery,
  createReferralOnRegistration,
};