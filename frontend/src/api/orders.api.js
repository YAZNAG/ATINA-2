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

// Delivery slots (per node)
export const getDeliverySlots    = (params)   => api.get(`${b}/delivery-slots`, { params });
export const getDeliverySlot     = (id)       => api.get(`${b}/delivery-slots/${id}`);
export const createDeliverySlot  = (data)     => api.post(`${b}/delivery-slots`, data);
export const updateDeliverySlot  = (id, data) => api.put(`${b}/delivery-slots/${id}`, data);
export const deleteDeliverySlot  = (id)       => api.delete(`${b}/delivery-slots/${id}`);

// App configs (order rules + payment per node)
export const getOrderConfigs     = (params)   => api.get(`${b}/configs`, { params });
export const getConfigKeys       = ()         => api.get(`${b}/configs/keys`);
export const saveOrderConfig     = (data)     => api.post(`${b}/configs`, data);
export const deleteOrderConfig   = (id)       => api.delete(`${b}/configs/${id}`);
export const seedOrderConfigs    = ()         => api.post(`${b}/configs/seed`);
