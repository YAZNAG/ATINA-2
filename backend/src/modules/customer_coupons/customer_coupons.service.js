const prisma = require('../../config/database');
const {
  PROMO_INCLUDE, formatCoupon, validateCoupon, computeCouponDiscount,
} = require('../coupons/coupons.shared');


//Valide un code pour le client
async function validateCode(code, customerId, subtotal = 0, deliveryFee = 0) {
  if (!code) throw { statusCode: 400, message: 'Code requis' };

  const promo = await validateCoupon(code.toUpperCase().trim(), customerId, subtotal);

  const { discount, free_shipping } = computeCouponDiscount(promo, subtotal, deliveryFee);

  const deliveryAlreadyFree = free_shipping && Number(deliveryFee) === 0;

  return {
    valid:         true,
    promotion_id:  promo.id,
    code:          promo.code,
    type:          promo.promo_type?.code,
    discount,
    free_shipping,
    warning:       deliveryAlreadyFree
      ? 'La livraison est déjà gratuite pour cette commande. Ce coupon ne vous apportera pas de réduction supplémentaire.'
      : null,
    message:       deliveryAlreadyFree ? 'Code enregistré' : 'Code promo appliqué',
  };
}

async function listMyCoupons(customerId) {
  const now = new Date();

  const [allPromos, redemptions] = await Promise.all([
    prisma.promotion.findMany({
      where: {
        is_deleted: false,
        OR: [{ customer_id: null }, { customer_id: customerId }],
      },
      include: PROMO_INCLUDE,
      orderBy: { valid_to: 'asc' },
    }),
    prisma.couponRedemption.groupBy({
      by: ['promotion_id'],
      where: { customer_id: customerId },
      _count: { promotion_id: true },
    }),
  ]);

  const usedMap = Object.fromEntries(redemptions.map(r => [r.promotion_id, r._count.promotion_id]));

  const available = [];
  const used      = [];
  const expired   = [];

  for (const p of allPromos) {
    const userUses     = usedMap[p.id] ?? 0;
    const isDateValid  = new Date(p.valid_from) <= now && new Date(p.valid_to) >= now;
    const isGlobalMaxed = p.uses_max != null && p.uses_count >= p.uses_max;
    const isUserMaxed  = userUses >= p.uses_per_user_max;

    if (p.is_active && isDateValid && !isGlobalMaxed && !isUserMaxed) {
      available.push(formatCoupon(p));
    } else if (userUses > 0 && isUserMaxed) {
      used.push(formatCoupon(p));
    } else if (!p.is_active || !isDateValid) {
      expired.push(formatCoupon(p));
    }
    // coupon globalement épuisé mais jamais utilisé par ce client → non affiché
  }

  return { available, used, expired };
}

module.exports = { validateCode, listMyCoupons };