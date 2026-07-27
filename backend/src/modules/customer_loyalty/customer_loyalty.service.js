const prisma = require('../../config/database');
const { POINTS_PER_MAD, MILESTONE_STEP, REDEEM_MAD } = require('../loyalty/loyalty.shared');

function labelFor(txn) {
  if (txn.type === 'redeem') return `Coupon ${(txn.points * -1 / POINTS_PER_MAD).toFixed(0)} MAD utilisé`;
  return txn.label;
}

class CustomerLoyaltyService {

  async getSummary(customerId) {
    const customer = await prisma.customer.findUnique({
      where:  { id: customerId },
      select: { points_balance: true, points_lifetime: true },
    });
    if (!customer) throw { statusCode: 404, message: 'Client introuvable' };

    const balance    = customer.points_balance;
    const nextMilestone = Math.ceil((balance + 1) / MILESTONE_STEP) * MILESTONE_STEP;
    const remaining      = Math.max(0, nextMilestone - balance);
    const progressPct    = Math.min(100, Math.round((balance / nextMilestone) * 100));

    return {
      points_balance:   balance,
      points_lifetime:  customer.points_lifetime,
      next_milestone:   nextMilestone,
      remaining_points: remaining,
      progress_pct:     progressPct,
      reward_mad:       Math.round((nextMilestone / POINTS_PER_MAD)),
      can_redeem:       balance >= MILESTONE_STEP,
      redeem_cost:      MILESTONE_STEP,
      redeem_reward_mad: REDEEM_MAD,
    };
  }

  async getHistory(customerId, limit = 20, cursor = null) {
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
      label:      labelFor(t),
      created_at: t.created_at,
    }));

    return { items, next_cursor: hasMore ? items[items.length - 1].id : null };
  }

  async redeem(customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }, select: { points_balance: true },
    });
    if (!customer) throw { statusCode: 404, message: 'Client introuvable' };
    if (customer.points_balance < MILESTONE_STEP) {
      throw { statusCode: 400, message: `Il vous faut au moins ${MILESTONE_STEP} points pour échanger.` };
    }

    const promoType = await prisma.promoType.findFirst({ where: { code: 'fixed' } });
    if (!promoType) throw { statusCode: 500, message: 'Configuration promotions manquante.' };

    const code = `FID${Date.now().toString(36).toUpperCase()}`;
    const validTo = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 jours

    const [updatedCustomer, coupon] = await prisma.$transaction(async (tx) => {
      const upd = await tx.customer.update({
        where: { id: customerId },
        data:  { points_balance: { decrement: MILESTONE_STEP } },
      });

      await tx.pointsTransaction.create({
        data: {
          customer_id:   customerId,
          type:          'redeem',
          points:        -MILESTONE_STEP,
          balance_after: upd.points_balance,
          label:         `Coupon ${REDEEM_MAD} MAD échangé`,
        },
      });

      const promo = await tx.promotion.create({
        data: {
          promo_type_id: promoType.id,
          code,
          value:            REDEEM_MAD,
          customer_id:       customerId,
          uses_max:          1,
          uses_per_user_max: 1,
          valid_from:        new Date(),
          valid_to:          validTo,
        },
      });

      return [upd, promo];
    });

    return {
      points_balance: updatedCustomer.points_balance,
      coupon: { code: coupon.code, value_mad: REDEEM_MAD, valid_to: coupon.valid_to },
    };
  }
}

module.exports = new CustomerLoyaltyService();