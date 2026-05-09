import api from './axios';

const d = '/delivery';

// ——— Delivery Types ———
export const getDeliveryTypes     = (params) => api.get(`${d}/types`, { params });
export const getDeliveryTypesList = ()        => api.get(`${d}/types`, { params: { all: true } });
export const getDeliveryType      = (id)      => api.get(`${d}/types/${id}`);
export const createDeliveryType   = (data)    => api.post(`${d}/types`, data);
export const updateDeliveryType   = (id, data) => api.put(`${d}/types/${id}`, data);
export const deleteDeliveryType   = (id)      => api.delete(`${d}/types/${id}`);
export const seedDeliveryTypes    = ()        => api.post(`${d}/types/seed`);
