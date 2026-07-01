import api from '../api/client';

export interface Coupon {
  id:               string;
  code:             string;
  type:             'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING' | 'BUY_X_GET_Y' | 'BUNDLE';
  value:            number;
  max_discount:     number | null;
  min_order_amount: number;
  valid_from:       string;
  valid_to:         string;
  uses_per_user_max: number;
}

export interface MyCoupons {
  available: Coupon[];
  used:      Coupon[];
  expired:   Coupon[];
}

export interface CouponValidation {
  valid:         boolean;
  promotion_id:  string;
  code:          string;
  type:          string;
  discount:      number;
  free_shipping: boolean;
  warning:       string | null;
  message:       string;
}

export const CouponsService = {
  async listMyCoupons(): Promise<MyCoupons> {
    const res = await api.get('/customer/coupons');
    return res.data.data;
  },

  async validateCode(code: string, subtotal: number, deliveryFee = 0): Promise<CouponValidation> {
    const res = await api.post('/customer/coupons/validate', {
      code, subtotal, delivery_fee: deliveryFee,
    });
    return res.data.data;
  },
};

export function couponTitle(c: Coupon): string {
  switch (c.type) {
    case 'PERCENTAGE':   return `-${c.value}% sur votre commande`;
    case 'FIXED':        return `-${c.value} MAD sur votre commande`;
    case 'FREE_SHIPPING': return 'Livraison gratuite';
    case 'BUY_X_GET_Y':  return 'Offre spéciale';
    case 'BUNDLE':       return 'Pack avantageux';
    default:             return 'Réduction';
  }
}

export function couponDescription(c: Coupon): string {
  if (c.type === 'FREE_SHIPPING') return 'Valable pour une livraison standard';
  if (c.min_order_amount > 0)
    return `Valable sur les commandes supérieures à ${c.min_order_amount} MAD`;
  return 'Valable sur toutes les commandes';
}

export function couponIcon(c: Coupon): string {
  switch (c.type) {
    case 'PERCENTAGE':    return '%';
    case 'FIXED':         return 'MAD';
    case 'FREE_SHIPPING': return '🚚';
    default:              return '🎁';
  }
}
