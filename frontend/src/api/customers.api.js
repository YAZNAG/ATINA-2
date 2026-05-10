import api from './axios';

export const getCustomers = (params) => api.get('/customers', { params });
export const getCustomer = (id) => api.get(`/customers/${id}`);
export const createCustomer = (body) => api.post('/customers', body);
export const updateCustomer = (id, body) => api.put(`/customers/${id}`, body);
export const blockCustomer = (id) => api.put(`/customers/${id}/block`);
export const unblockCustomer = (id) => api.put(`/customers/${id}/unblock`);
export const deleteCustomer = (id) => api.delete(`/customers/${id}`);

// Addresses
export const getAddresses      = (customer_id)        => api.get(`/customers/${customer_id}/addresses`);
export const createAddress     = (customer_id, data)  => api.post(`/customers/${customer_id}/addresses`, data);
export const updateAddress     = (id, data)            => api.put(`/addresses/${id}`, data);
export const setDefaultAddress = (id)                  => api.patch(`/addresses/${id}/set-default`);
export const deleteAddress     = (id)                  => api.delete(`/addresses/${id}`);
