import api from './axios';

const b = '/orders';

// Order statuses
export const getOrderStatuses    = (params) => api.get(`${b}/statuses`, { params });
export const getOrderStatus      = (id)     => api.get(`${b}/statuses/${id}`);
export const createOrderStatus   = (data)   => api.post(`${b}/statuses`, data);
export const updateOrderStatus   = (id, data) => api.put(`${b}/statuses/${id}`, data);
export const deleteOrderStatus   = (id)     => api.delete(`${b}/statuses/${id}`);
export const seedOrderStatuses   = ()       => api.post(`${b}/statuses/seed`);

// Order item statuses
export const getOrderItemStatuses   = (params) => api.get(`${b}/item-statuses`, { params });
export const getOrderItemStatus     = (id)     => api.get(`${b}/item-statuses/${id}`);
export const createOrderItemStatus  = (data)   => api.post(`${b}/item-statuses`, data);
export const updateOrderItemStatus  = (id, data) => api.put(`${b}/item-statuses/${id}`, data);
export const deleteOrderItemStatus  = (id)     => api.delete(`${b}/item-statuses/${id}`);
export const seedOrderItemStatuses  = ()       => api.post(`${b}/item-statuses/seed`);

// Order slot statuses
export const getOrderSlotStatuses   = (params) => api.get(`${b}/slot-statuses`, { params });
export const getOrderSlotStatus     = (id)     => api.get(`${b}/slot-statuses/${id}`);
export const createOrderSlotStatus  = (data)   => api.post(`${b}/slot-statuses`, data);
export const updateOrderSlotStatus  = (id, data) => api.put(`${b}/slot-statuses/${id}`, data);
export const deleteOrderSlotStatus  = (id)     => api.delete(`${b}/slot-statuses/${id}`);
export const seedOrderSlotStatuses  = ()       => api.post(`${b}/slot-statuses/seed`);
