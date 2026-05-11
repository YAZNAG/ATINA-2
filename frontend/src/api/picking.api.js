import api from './axios';
const b = '/picking';

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
