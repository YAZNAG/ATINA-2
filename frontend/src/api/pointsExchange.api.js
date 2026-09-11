import api from './axios';

// ——— Point Exchange (catalogue d'échange de points) — module backend /points-exchange ———
const px = '/points-exchange';

export const getExchangeRules        = (params)     => api.get(px, { params });
export const getExchangeRule         = (id)         => api.get(`${px}/${id}`);
export const getExchangeEligibleSkus = (params)     => api.get(`${px}/eligible-skus`, { params });
export const getPointsExchanges      = (params)     => api.get(`${px}/exchanges`, { params });
export const createExchangeRule      = (data)       => api.post(px, data);
export const updateExchangeRule      = (id, data)   => api.put(`${px}/${id}`, data);
export const activateExchangeRule    = (id)         => api.patch(`${px}/${id}/activate`);
export const deactivateExchangeRule  = (id)         => api.patch(`${px}/${id}/deactivate`);
export const duplicateExchangeRule   = (id, data)   => api.post(`${px}/${id}/duplicate`, data);
export const deleteExchangeRule      = (id)         => api.delete(`${px}/${id}`);
