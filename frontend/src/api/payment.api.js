import api from './axios';

const p = '/payment';

// ——— Payment Statuses ———
export const getPaymentStatuses     = (params) => api.get(`${p}/statuses`, { params });
export const getPaymentStatusesList = ()        => api.get(`${p}/statuses`, { params: { all: true } });
export const getPaymentStatus       = (id)      => api.get(`${p}/statuses/${id}`);
export const createPaymentStatus    = (data)    => api.post(`${p}/statuses`, data);
export const updatePaymentStatus    = (id, data) => api.put(`${p}/statuses/${id}`, data);
export const deletePaymentStatus    = (id)      => api.delete(`${p}/statuses/${id}`);
export const seedPaymentStatuses    = ()        => api.post(`${p}/statuses/seed`);

// ——— Payment Methods ———
export const getPaymentMethods      = (params)  => api.get(`${p}/methods`, { params });
export const getPaymentMethodsList  = ()         => api.get(`${p}/methods`, { params: { all: true } });
export const getPaymentMethod       = (id)       => api.get(`${p}/methods/${id}`);
export const createPaymentMethod    = (data)     => api.post(`${p}/methods`, data);
export const updatePaymentMethod    = (id, data) => api.put(`${p}/methods/${id}`, data);
export const deletePaymentMethod    = (id)       => api.delete(`${p}/methods/${id}`);
export const togglePaymentMethodActive = (id)    => api.patch(`${p}/methods/${id}/toggle-active`);
export const seedPaymentMethods     = ()         => api.post(`${p}/methods/seed`);
