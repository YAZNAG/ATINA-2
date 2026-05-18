import api from './axios';

const b = '/delivery';

// ── Meta ──────────────────────────────────────────────────────────────────────
export const getDeliveryMeta = ()            => api.get(`${b}/meta`);
export const getDrivers      = (params)      => api.get(`${b}/drivers`, { params });

// ── Ready home orders ─────────────────────────────────────────────────────────
export const getReadyHomeOrders = (params)   => api.get(`${b}/ready-orders`, { params });

// ── Tours CRUD ────────────────────────────────────────────────────────────────
export const getTours     = (params)         => api.get(`${b}/tours`, { params });
export const getTour      = (id)             => api.get(`${b}/tours/${id}`);
export const createTour   = (data)           => api.post(`${b}/tours`, data);
export const addOrders    = (id, order_ids)  => api.post(`${b}/tours/${id}/orders`, { order_ids });
export const removeStop   = (id, stopId)     => api.delete(`${b}/tours/${id}/stops/${stopId}`);
export const assignDriver = (id, driver_id)  => api.patch(`${b}/tours/${id}/assign-driver`, { driver_id });
export const startTour    = (id)             => api.patch(`${b}/tours/${id}/start`);
export const completeTour = (id)             => api.patch(`${b}/tours/${id}/complete`);

// ── Stop actions ──────────────────────────────────────────────────────────────
export const arriveStop  = (stopId, data)    => api.patch(`${b}/stops/${stopId}/arrive`, data);
export const deliverStop = (stopId, data)    => api.patch(`${b}/stops/${stopId}/deliver`, data);
export const failStop    = (stopId, data)    => api.patch(`${b}/stops/${stopId}/fail`, data);
