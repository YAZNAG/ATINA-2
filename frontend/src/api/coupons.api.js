import api from './axios';

const c = '/coupons';

// ——— Codes promo (Offres > Codes Promo) ———
export const getCoupons              = (params)        => api.get(c, { params });
export const getCoupon               = (id)            => api.get(`${c}/${id}`);
export const createCoupon            = (data)          => api.post(c, data);
export const updateCoupon            = (id, data)      => api.put(`${c}/${id}`, data);
export const setCouponActive         = (id, is_active) => api.patch(`${c}/${id}/status`, { is_active });
export const getCouponDeletionCheck  = (id, attempt = false) =>
  api.get(`${c}/${id}/deletion-check`, { params: attempt ? { attempt: true } : {} });
export const deleteCoupon            = (id)            => api.delete(`${c}/${id}`);

// ——— Référentiels ———
export const getCouponLookups        = ()              => api.get(`${c}/lookups`);
export const searchCouponCustomers   = (search)        => api.get(`${c}/customers`, { params: { search } });

// ——— Utilisations (suivi) — lecture seule ———
export const getCouponRedemptions    = (params)        => api.get(`${c}/redemptions`, { params });
export const getCouponRedemptionOrder = (orderId)      => api.get(`${c}/redemptions/${orderId}`);
