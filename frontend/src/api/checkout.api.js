import api from './axios';

const b = '/checkout';

export const getCheckoutMeta    = ()             => api.get(`${b}/meta`);
export const getEligibleNodes   = (data)         => api.post(`${b}/eligible-nodes`, data);
export const getDeliverySlots   = (params)       => api.get(`${b}/delivery-slots`, { params });
export const createOrder        = (data)         => api.post(`${b}/create-order`, data);
export const searchArticles     = (params)       => api.get(`${b}/articles`, { params });
