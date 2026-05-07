import api from './axios';

const s = '/stock';

export const getMoveTypes     = (params) => api.get(`${s}/move-types`, { params });
export const getMoveTypesList = ()       => api.get(`${s}/move-types`, { params: { all: true } });
export const getMoveType      = (id)     => api.get(`${s}/move-types/${id}`);
export const createMoveType   = (data)   => api.post(`${s}/move-types`, data);
export const updateMoveType   = (id, data) => api.put(`${s}/move-types/${id}`, data);
export const deleteMoveType   = (id)     => api.delete(`${s}/move-types/${id}`);
