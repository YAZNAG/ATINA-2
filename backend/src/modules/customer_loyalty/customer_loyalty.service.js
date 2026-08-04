const prisma = require('../../config/database');
const { getRedemptionConfig } = require('../loyalty/loyalty.config');
const { creditReward } = require('../loyalty/reward-credit.util');

function labelFor(txn, pointsPerMad) {
  if (txn.type === 'redeem') return `Coupon ${(txn.points * -1 / pointsPerMad).toFixed(0)} MAD utilisé`;
  return txn.label;
}

class CustomerLoyaltyService {

  async getSummary(customerId, node_id = null) {
    const customer = await prisma.customer.findUnique({
      where:  { id: customerId },
      select: { points_balance: true, points_lifetime: true },
    });
    if (!customer) throw { statusCode: 404, message: 'Client introuvable' };

    const { milestone_step, redeem_mad } = await getRedemptionConfig(node_id);

    const balance          = customer.points_balance;
    const intoCurrentCycle = balance % milestone_step;
    const remaining        = balance >= milestone_step ? 0 : milestone_step - intoCurrentCycle;
    const progressPct      = Math.min(100, Math.round((intoCurrentCycle / milestone_step) * 100));

    return {
      points_balance:    balance,
      points_lifetime:   customer.points_lifetime,
      next_milestone:    milestone_step,
      remaining_points:  remaining,
      progress_pct:      balance >= milestone_step ? 100 : progressPct,
      can_redeem:        balance >= milestone_step,
      redeem_cost:       milestone_step,
      redeem_reward_mad: redeem_mad,
    };
  }

  async getHistory(customerId, limit = 20, cursor = null, node_id = null) {
    const { points_per_mad } = await getRedemptionConfig(node_id);

    const txns = await prisma.pointsTransaction.findMany({
      where: { customer_id: customerId },
      orderBy: { created_at: 'desc' },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore = txns.length > limit;
    const items   = (hasMore ? txns.slice(0, limit) : txns).map(t => ({
      id:         t.id,
      type:       t.type,
      points:     t.points,
      label:      labelFor(t, points_per_mad),
      created_at: t.created_at,
    }));

    return { items, next_cursor: hasMore ? items[items.length - 1].id : null };
  }

  async redeem(customerId, node_id = null) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId }, select: { points_balance: true },
  });
  if (!customer) throw { statusCode: 404, message: 'Client introuvable' };

  const { milestone_step, redeem_mad, reward_type_code, rule_id } = await getRedemptionConfig(node_id);
  console.log('[redeem] config:', { milestone_step, redeem_mad, reward_type_code, rule_id, balance: customer.points_balance });

  if (customer.points_balance < milestone_step) {
    throw { statusCode: 400, message: `Il vous faut au moins ${milestone_step} points pour échanger.` };
  }

  const result = await prisma.$transaction(async (tx) => {
    const upd = await tx.customer.update({
      where: { id: customerId },
      data:  { points_balance: { decrement: milestone_step } },
    });

    await tx.pointsTransaction.create({
      data: {
        customer_id:   customerId,
        type:          'redeem',
        points:        -milestone_step,
        balance_after: upd.points_balance,
        label:         `Rachat ${redeem_mad} MAD (${reward_type_code})`,
      },
    });

    // ── Coupon ──
    if (reward_type_code === 'COUPON') {
      const promoType = await tx.promoType.findFirst({ where: { code: 'FIXED' } });
      if (!promoType) throw { statusCode: 500, message: 'Configuration promotions manquante.' };

      const code    = `FID${Date.now().toString(36).toUpperCase()}`;
      const validTo = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      const promo = await tx.promotion.create({
        data: {
          promo_type_id:     promoType.id,
          code,
          value:              redeem_mad,
          customer_id:        customerId,
          uses_max:           1,
          uses_per_user_max:  1,
          valid_from:         new Date(),
          valid_to:           validTo,
        },
      });

      return {
        points_balance: upd.points_balance,
        reward: { type: 'coupon', code: promo.code, value_mad: redeem_mad, valid_to: promo.valid_to },
      };
    }

    // ── Wallet / crédit direct ──
    if (reward_type_code === 'WALLET' || reward_type_code === 'DISCOUNT') {
      const walletTxnType = await tx.walletTxnType.findFirst({ where: { code: 'POINTS_REDEMPTION' } });
      const credited = await creditReward(tx, customerId, reward_type_code, redeem_mad, walletTxnType, `Points échangés — palier ${milestone_step}`);

      return {
        points_balance: upd.points_balance,
        reward: { type: 'wallet', amount_mad: credited.amount },
      };
    }

    throw { statusCode: 500, message: `reward_type_code "${reward_type_code}" non supporté pour un rachat.` };
  });

  return { ...result, rule_applied: rule_id };
}
}

module.exports = new CustomerLoyaltyService();