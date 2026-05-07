import api from './axios';

const s = '/stock';

export const getMoveTypes     = (params) => api.get(`${s}/move-types`, { params });
export const getMoveTypesList = ()       => api.get(`${s}/move-types`, { params: { all: true } });
export const getMoveType      = (id)     => api.get(`${s}/move-types/${id}`);
export const createMoveType   = (data)   => api.post(`${s}/move-types`, data);
export const updateMoveType   = (id, data) => api.put(`${s}/move-types/${id}`, data);
export const deleteMoveType   = (id)     => api.delete(`${s}/move-types/${id}`);

// ——— Inventory Types ———
export const getInventoryTypes     = (params)   => api.get(`${s}/inventory-types`, { params });
export const getInventoryTypesList = ()         => api.get(`${s}/inventory-types`, { params: { all: true } });
export const getInventoryType      = (id)       => api.get(`${s}/inventory-types/${id}`);
export const createInventoryType   = (data)     => api.post(`${s}/inventory-types`, data);
export const updateInventoryType   = (id, data) => api.put(`${s}/inventory-types/${id}`, data);
export const deleteInventoryType   = (id)       => api.delete(`${s}/inventory-types/${id}`);

// ——— Stock Statuses ———
export const getStockStatuses     = (params)    => api.get(`${s}/stock-statuses`, { params });
export const getStockStatusesList = ()          => api.get(`${s}/stock-statuses`, { params: { all: true } });
export const getStockStatus       = (id)        => api.get(`${s}/stock-statuses/${id}`);
export const createStockStatus    = (data)      => api.post(`${s}/stock-statuses`, data);
export const updateStockStatus    = (id, data)  => api.put(`${s}/stock-statuses/${id}`, data);
export const deleteStockStatus    = (id)        => api.delete(`${s}/stock-statuses/${id}`);
