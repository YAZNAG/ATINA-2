import api from './axios';

// Comptes Back-Office — filtres : search, role_id, status (active | inactive | deleted), page, limit
export const getUsers = (params) => api.get('/users', { params });
export const getUser = (id) => api.get(`/users/${id}`);
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const assignUserRole = (id, roleIds) => api.patch(`/users/${id}/role`, { role_ids: roleIds });
export const activateUser = (id) => api.patch(`/users/${id}/activate`);
export const deactivateUser = (id) => api.patch(`/users/${id}/deactivate`);
export const restoreUser = (id) => api.patch(`/users/${id}/restore`);
// Suppression = soft-delete (is_deleted + deleted_at)
export const deleteUser = (id) => api.delete(`/users/${id}`);
