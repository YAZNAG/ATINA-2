import api from './axios';

// Comptage / Inventaire physique — backend monté sur /stock-counts
const b = '/stock-counts';

export const getStockCountRefs   = ()                => api.get(`${b}/refs`);
export const getStockCounts      = (params)          => api.get(b, { params });
export const getStockCount       = (id)              => api.get(`${b}/${id}`);
export const createStockCount    = (data)            => api.post(b, data);
export const saveStockCountLines = (id, lines)       => api.put(`${b}/${id}/lines`, { lines });
export const validateStockCount  = (id)              => api.post(`${b}/${id}/validate`);
export const cancelStockCount    = (id, reason)      => api.post(`${b}/${id}/cancel`, { reason });

// Endpoints Inventaire complémentaires (module stock existant)
export const getReorderAlerts     = (params) => api.get('/stock/reorder-rules/alerts', { params });
export const getReorderThresholds = (params) => api.get('/stock/reorder-rules/thresholds', { params });
