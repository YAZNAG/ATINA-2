import api from './axios';

export const getRegions = (params) => api.get('/regions', { params });
export const getRegion = (id) => api.get(`/regions/${id}`);
export const createRegion = (data) => api.post('/regions', data);
export const updateRegion = (id, data) => api.put(`/regions/${id}`, data);
export const deleteRegion = (id) => api.delete(`/regions/${id}`);

export const getProvinces = (params) => api.get('/provinces', { params });
export const getProvince = (id) => api.get(`/provinces/${id}`);
export const createProvince = (data) => api.post('/provinces', data);
export const updateProvince = (id, data) => api.put(`/provinces/${id}`, data);
export const deleteProvince = (id) => api.delete(`/provinces/${id}`);

export const getCities = (params) => api.get('/cities', { params });
export const getCity = (id) => api.get(`/cities/${id}`);
export const createCity = (data) => api.post('/cities', data);
export const updateCity = (id, data) => api.put(`/cities/${id}`, data);
export const deleteCity = (id) => api.delete(`/cities/${id}`);

export const getNodeTypes = () => api.get('/node-types');
export const getNodeType = (id) => api.get(`/node-types/${id}`);
export const createNodeType = (data) => api.post('/node-types', data);
export const updateNodeType = (id, data) => api.put(`/node-types/${id}`, data);
export const deleteNodeType = (id) => api.delete(`/node-types/${id}`);

export const getNodes = (params) => api.get('/nodes', { params });
export const getNode = (id) => api.get(`/nodes/${id}`);
export const createNode = (data) => api.post('/nodes', data);
export const updateNode = (id, data) => api.put(`/nodes/${id}`, data);
export const deleteNode = (id) => api.delete(`/nodes/${id}`);

export const getNodeSlots = (nodeId) => api.get(`/nodes/${nodeId}/slots`);
export const createNodeSlot = (nodeId, data) => api.post(`/nodes/${nodeId}/slots`, data);
export const updateSlot = (slotId, data) => api.put(`/slots/${slotId}`, data);
export const deleteSlot = (slotId) => api.delete(`/slots/${slotId}`);
