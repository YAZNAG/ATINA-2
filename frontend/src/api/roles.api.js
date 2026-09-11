import api from './axios';

// Filtres : search, status (active | inactive), assignable=true (rôles actifs uniquement)
export const getRoles = (params) => api.get('/roles', { params });
export const getAssignableRoles = () => api.get('/roles', { params: { assignable: true } });
export const getRole = (id) => api.get(`/roles/${id}`);
export const createRole = (data) => api.post('/roles', data);
export const updateRole = (id, data) => api.put(`/roles/${id}`, data);
export const activateRole = (id) => api.patch(`/roles/${id}/activate`);
export const deactivateRole = (id) => api.patch(`/roles/${id}/deactivate`);
export const deleteRole = (id) => api.delete(`/roles/${id}`);
export const assignPermissions = (id, data) => api.post(`/roles/${id}/permissions`, data);
export const getRolePermissions = (id) => api.get(`/roles/${id}/permissions`);
