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

// ——— Inventory Statuses ———
export const getInventoryStatuses     = (params)   => api.get(`${s}/inventory-statuses`, { params });
export const getInventoryStatusesList = ()         => api.get(`${s}/inventory-statuses`, { params: { all: true } });
export const getInventoryStatus       = (id)       => api.get(`${s}/inventory-statuses/${id}`);
export const createInventoryStatus    = (data)     => api.post(`${s}/inventory-statuses`, data);
export const updateInventoryStatus    = (id, data) => api.put(`${s}/inventory-statuses/${id}`, data);
export const deleteInventoryStatus    = (id)       => api.delete(`${s}/inventory-statuses/${id}`);

// ——— Inventory Gap Types ———
export const getInventoryGapTypes     = (params)   => api.get(`${s}/inventory-gap-types`, { params });
export const getInventoryGapTypesList = ()         => api.get(`${s}/inventory-gap-types`, { params: { all: true } });
export const getInventoryGapType      = (id)       => api.get(`${s}/inventory-gap-types/${id}`);
export const createInventoryGapType   = (data)     => api.post(`${s}/inventory-gap-types`, data);
export const updateInventoryGapType   = (id, data) => api.put(`${s}/inventory-gap-types/${id}`, data);
export const deleteInventoryGapType   = (id)       => api.delete(`${s}/inventory-gap-types/${id}`);

// ——— Stock Threshold Rules ———
export const getStockThresholds   = (node_id)        => api.get(`${s}/thresholds`, { params: { node_id } });
export const createStockThreshold = (data)            => api.post(`${s}/thresholds`, data);
export const updateStockThreshold = (id, data)        => api.put(`${s}/thresholds/${id}`, data);
export const deleteStockThreshold = (id)              => api.delete(`${s}/thresholds/${id}`);
export const bulkSaveThresholds   = (node_id, rows)   => api.post(`${s}/thresholds/bulk-save`, { node_id, rows });

// ——— Stock Levels ———
export const getStockLevels      = (params)  => api.get(`${s}/levels`, { params: typeof params === 'string' ? { node_id: params } : params });
export const getStockLevelById   = (id)      => api.get(`${s}/levels/${id}`);
export const stockReceipt        = (data)    => api.post(`${s}/levels/receipt`, data);
export const stockReserve        = (data)    => api.post(`${s}/levels/reserve`, data);
export const stockPicking        = (data)    => api.post(`${s}/levels/picking`, data);
export const stockCancelReserve  = (data)    => api.post(`${s}/levels/cancel`, data);
export const stockUpdateIncoming = (data)    => api.post(`${s}/levels/incoming`, data);
export const stockCODDelivered   = (data)    => api.post(`${s}/levels/cod-delivered`, data);
export const stockCODCollected   = (data)    => api.post(`${s}/levels/cod-collected`, data);
export const stockCount          = (data)    => api.post(`${s}/levels/count`, data);
export const adjustStockLevel    = (data)    => api.post(`${s}/levels/adjust`, data);
export const recalculateStock    = (data)    => api.post(`${s}/levels/recalculate`, data);
export const applyStockMove      = (data)    => api.post(`${s}/levels/move`, data);

// ——— Stock Statuses ———
export const getStockStatuses     = (params)    => api.get(`${s}/stock-statuses`, { params });
export const getStockStatusesList = ()          => api.get(`${s}/stock-statuses`, { params: { all: true } });
export const getStockStatus       = (id)        => api.get(`${s}/stock-statuses/${id}`);
export const createStockStatus    = (data)      => api.post(`${s}/stock-statuses`, data);
export const updateStockStatus    = (id, data)  => api.put(`${s}/stock-statuses/${id}`, data);
export const deleteStockStatus    = (id)        => api.delete(`${s}/stock-statuses/${id}`);
