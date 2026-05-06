import api from './axios';

const w = '/warehouse';

// ——— Zones ———
export const getZones = (params) => api.get(`${w}/zones`, { params });
export const getZonesList = () => api.get(`${w}/zones`, { params: { all: true } });
export const createZone = (data) => api.post(`${w}/zones`, data);
export const updateZone = (id, data) => api.put(`${w}/zones/${id}`, data);
export const deleteZone = (id) => api.delete(`${w}/zones/${id}`);

// ——— Niveaux ———
export const getLevels = (params) => api.get(`${w}/levels`, { params });
export const getLevelsList = () => api.get(`${w}/levels`, { params: { all: true } });
export const createLevel = (data) => api.post(`${w}/levels`, data);
export const updateLevel = (id, data) => api.put(`${w}/levels/${id}`, data);
export const deleteLevel = (id) => api.delete(`${w}/levels/${id}`);

// ——— Emplacements ———
export const getLocations = (params) => api.get(`${w}/locations`, { params });
export const getLocationsList = (params) => api.get(`${w}/locations`, { params: { all: true, ...params } });
export const createLocation = (data) => api.post(`${w}/locations`, data);
export const bulkGenerateLocations = (data) => api.post(`${w}/locations/bulk-generate`, data);
export const updateLocation = (id, data) => api.put(`${w}/locations/${id}`, data);
export const deleteLocation = (id) => api.delete(`${w}/locations/${id}`);

// ——— SKU ↔ Emplacement ———
export const getSkuLocations = (params) => api.get(`${w}/sku-locations`, { params });
export const createSkuLocation = (data) => api.post(`${w}/sku-locations`, data);
export const updateSkuLocation = (id, data) => api.put(`${w}/sku-locations/${id}`, data);
export const deleteSkuLocation = (id) => api.delete(`${w}/sku-locations/${id}`);
