const prisma = require('../../config/database');

const PROMO_INCLUDE = {
  promo_type: { select: { id: true, code: true, name_fr: true, name_ar: true } },
  customer:   { select: { id: true, name: true, phone_number: true } },
};

function formatCoupon(p) {
  return {
    id:                p.id,
    code:              p.code,
    type:              p.promo_type?.code,           
    type_name:         p.promo_type?.name_fr,
    value:             Number(p.value),
    max_discount:      p.max_discount != null ? Number(p.max_discount) : null,
    min_order_amount:  Number(p.min_order_amount),
    scope:             p.customer_id ? 'personal' : 'public',
    customer_id:       p.customer_id,
    customer_name:     p.customer?.name ?? null,
    node_id:           p.node_id,
    uses_max:          p.uses_max,
    uses_count:        p.uses_count,
    uses_per_user_max: p.uses_per_user_max,
    valid_from:        p.valid_from,
    valid_to:          p.valid_to,
    is_active:         p.is_active,
  };
}

//calculer la reduction d'un coupon sur un sous total
function computeCouponDiscount(promo, subtotal, deliveryFee = 0) {
  const type  = promo.promo_type?.code;
  const value = Number(promo.value ?? 0);
  const sub   = Number(subtotal ?? 0);

  if (type === 'PERCENTAGE') {
    let discount = sub * (value / 100);

    if (promo.max_discount != null) {
      discount = Math.min(discount, Number(promo.max_discount));
    }
    discount = Math.min(discount, sub);                 // jamais plus que le sous-total
    return { discount: Math.round(discount * 100) / 100, free_shipping: false };
  }

  if (type === 'FIXED') {
    const discount = Math.min(value, sub);              // jamais plus que le sous-total
    return { discount: Math.round(discount * 100) / 100, free_shipping: false };
  }

  if (type === 'FREE_SHIPPING') {
    return { discount: Math.round(Number(deliveryFee) * 100) / 100, free_shipping: true };
  }

  if (type === 'BUY_X_GET_Y') {
    throw { statusCode: 400, message: 'Type BUY_X_GET_Y pas encore supporté' };
  }

  throw { statusCode: 400, message: 'Type de coupon inconnu' };
}

/**
 * Validation d'un code au checkout.
 * @param {object} [opts] contrôles optionnels (US-076) — non appliqués si non fournis :
 *   opts.node_id         node de la commande : un code rattaché à un autre node est refusé (node_id NULL = global) ;
 *   opts.has_other_offer TRUE si le panier bénéficie déjà d'une flash sale ou d'un pack remisé :
 *                        refus si le code n'est pas cumulable (is_combined = FALSE).
 */
async function validateCoupon(code, customerId, subtotal = 0, opts = {}) {
  const promo = await prisma.promotion.findFirst({
    where:   { code, is_deleted: false },
    include: PROMO_INCLUDE,
  });

  if (!promo)            throw { statusCode: 404, message: 'Code promo introuvable' };
  if (!promo.is_active)  throw { statusCode: 400, message: 'Ce code promo n\'est plus actif' };

  const now = new Date();
  if (new Date(promo.valid_from) > now) throw { statusCode: 400, message: 'Ce code promo n\'est pas encore valide' };
  if (new Date(promo.valid_to)   < now) throw { statusCode: 400, message: 'Ce code promo a expiré' };

  if (Number(subtotal) < Number(promo.min_order_amount)) {
    throw { statusCode: 400, message: `Montant minimum de ${Number(promo.min_order_amount)} DH requis` };
  }

  if (promo.customer_id && promo.customer_id !== customerId) {
    throw { statusCode: 403, message: 'Ce code promo ne vous est pas destiné' };
  }

  if (opts.node_id && promo.node_id && promo.node_id !== opts.node_id) {
    throw { statusCode: 400, message: "Ce code promo n'est pas valable sur ce point de vente" };
  }

  if (opts.has_other_offer && !promo.is_combined) {
    throw { statusCode: 400, message: "Ce code promo n'est pas cumulable avec les offres déjà présentes dans votre panier" };
  }

  if (promo.uses_max != null && promo.uses_count >= promo.uses_max) {
    throw { statusCode: 400, message: 'Ce code promo a atteint sa limite d\'utilisation' };
  }

  const userUses = await prisma.couponRedemption.count({
    // Une utilisation liée à une commande annulée ne compte plus (US-110 bloc 8,
    // aucune suppression physique de coupon_redemptions).
    where: {
      promotion_id: promo.id,
      customer_id: customerId,
      OR: [{ order_id: null }, { order: { status: { code: { not: 'cancelled' } } } }],
    },
  });
  if (userUses >= promo.uses_per_user_max) {
    throw { statusCode: 400, message: 'Vous avez déjà utilisé ce code promo' };
  }

  return promo;
}

module.exports = { PROMO_INCLUDE, formatCoupon, computeCouponDiscount, validateCoupon };