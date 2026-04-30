import api from './axios';

export const getRegions = (params) => api.get('/regions', { params });
export const createRegion = (data) => api.post('/regions', data);
export const updateRegion = (id, data) => api.put(`/regions/${id}`, data);
export const deleteRegion = (id) => api.delete(`/regions/${id}`);

export const getProvinces = (params) => api.get('/provinces', { params });
export const createProvince = (data) => api.post('/provinces', data);
export const updateProvince = (id, data) => api.put(`/provinces/${id}`, data);

export const getCities = (params) => api.get('/cities', { params });
export const createCity = (data) => api.post('/cities', data);
export const updateCity = (id, data) => api.put(`/cities/${id}`, data);

export const getNodeTypes = () => api.get('/node-types');
export const createNodeType = (data) => api.post('/node-types', data);

export const getNodes = (params) => api.get('/nodes', { params });
export const getNode = (id) => api.get(`/nodes/${id}`);
export const createNode = (data) => api.post('/nodes', data);
export const updateNode = (id, data) => api.put(`/nodes/${id}`, data);
export const deleteNode = (id) => api.delete(`/nodes/${id}`);

export const getNodeSlots = (nodeId) => api.get(`/nodes/${nodeId}/slots`);
export const createNodeSlot = (nodeId, data) => api.post(`/nodes/${nodeId}/slots`, data);
export const updateSlot = (slotId, data) => api.put(`/slots/${slotId}`, data);
export const deleteSlot = (slotId) => api.delete(`/slots/${slotId}`);
