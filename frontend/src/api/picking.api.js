import api from './axios';
const b = '/picking';

// ── Paramétrage : Statuts picking ──────────────────────────────────────────────
export const getPickingStatuses     = (params) => api.get(`${b}/statuses`, { params });
export const createPickingStatus    = (data)   => api.post(`${b}/statuses`, data);
export const updatePickingStatus    = (id, d)  => api.put(`${b}/statuses/${id}`, d);
export const deletePickingStatus    = (id)     => api.delete(`${b}/statuses/${id}`);
export const seedPickingStatuses    = ()       => api.post(`${b}/statuses/seed`);

// ── Paramétrage : Statuts articles picking ────────────────────────────────────
export const getPickItemStatuses    = (params) => api.get(`${b}/item-statuses`, { params });
export const createPickItemStatus   = (data)   => api.post(`${b}/item-statuses`, data);
export const updatePickItemStatus   = (id, d)  => api.put(`${b}/item-statuses/${id}`, d);
export const deletePickItemStatus   = (id)     => api.delete(`${b}/item-statuses/${id}`);
export const seedPickItemStatuses   = ()       => api.post(`${b}/item-statuses/seed`);

export const getPickingSessions   = (params)          => api.get(`${b}/sessions`, { params });
export const getPickingSession    = (id)               => api.get(`${b}/sessions/${id}`);
export const createPickingSession = (data)             => api.post(`${b}/sessions`, data);
export const startSession         = (id, data)         => api.patch(`${b}/sessions/${id}/start`, data);
export const completeSession      = (id)               => api.patch(`${b}/sessions/${id}/complete`);
export const cancelSession        = (id)               => api.patch(`${b}/sessions/${id}/cancel`);
export const assignPicker         = (id, picker_id)    => api.patch(`${b}/sessions/${id}/picker`, { picker_id });

export const pickItem             = (id, data)         => api.patch(`${b}/items/${id}/pick`, data);
export const substituteItem       = (id)               => api.patch(`${b}/items/${id}/substitute`);
export const outOfStockItem       = (id)               => api.patch(`${b}/items/${id}/out-of-stock`);

export const getPickers           = (params)           => api.get(`${b}/pickers`, { params });
