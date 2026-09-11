import api from './axios';

export const getCustomers = (params) => api.get('/customers', { params });
export const exportCustomers = (params) => api.get('/customers/export', { params });
export const getCustomer = (id) => api.get(`/customers/${id}`);
export const createCustomer = (body) => api.post('/customers', body);
export const updateCustomer = (id, body) => api.put(`/customers/${id}`, body);
// Blocage : motif obligatoire (conservé dans audit_logs, action BLOCK_USER) ; déblocage : motif recommandé.
export const blockCustomer = (id, reason) => api.put(`/customers/${id}/block`, { reason });
export const unblockCustomer = (id, reason) => api.put(`/customers/${id}/unblock`, { reason });
export const getCustomerBlockHistory = (id) => api.get(`/customers/${id}/block-history`);
export const deleteCustomer = (id) => api.delete(`/customers/${id}`);
export const getCustomerOrders = (id, params) => api.get(`/customers/${id}/orders`, { params });

// Addresses
export const getAddresses      = (customer_id)        => api.get(`/customers/${customer_id}/addresses`);
export const createAddress     = (customer_id, data)  => api.post(`/customers/${customer_id}/addresses`, data);
export const updateAddress     = (id, data)            => api.put(`/addresses/${id}`, data);
export const setDefaultAddress = (id)                  => api.patch(`/addresses/${id}/set-default`);
export const deleteAddress     = (id)                  => api.delete(`/addresses/${id}`);

// Points & parrainage du client (module loyalty)
export const getPointsLedger = (customer_id, params) =>
  api.get(`/loyalty/customers/${customer_id}/ledger`, { params });
export const exportPointsLedger = (customer_id, params) =>
  api.get(`/loyalty/customers/${customer_id}/ledger/export`, { params });
// body : { amount (entier signé), reason (obligatoire) }
export const adjustPointsBalance = (customer_id, body) =>
  api.post(`/loyalty/customers/${customer_id}/adjust`, body);

export const getReferrals = (customer_id, params) => api.get(`/loyalty/customers/${customer_id}/referrals`, { params });
