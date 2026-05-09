import api from './axios';

export const getCustomers = (params) => api.get('/customers', { params });
export const getCustomer = (id) => api.get(`/customers/${id}`);
export const createCustomer = (body) => api.post('/customers', body);
export const updateCustomer = (id, body) => api.put(`/customers/${id}`, body);
export const blockCustomer = (id) => api.put(`/customers/${id}/block`);
export const unblockCustomer = (id) => api.put(`/customers/${id}/unblock`);
export const deleteCustomer = (id) => api.delete(`/customers/${id}`);
