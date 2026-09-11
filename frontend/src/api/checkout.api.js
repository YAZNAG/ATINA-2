import api from './axios';

const b = '/checkout';

export const getCheckoutMeta      = (node_id)       => api.get(`${b}/meta`, { params: { node_id } });
export const getAvailableDates    = (p)             => api.get(`${b}/available-dates`, { params: p });
export const searchArticles       = (search, limit) => api.get(`${b}/articles`, { params: { search, limit } });
export const searchCustomers      = (search)        => api.get(`${b}/customers`, { params: { search } });
export const getCustomerAddresses = (customerId)    => api.get(`${b}/customers/${customerId}/addresses`);
export const getEligibleNodes     = (data)          => api.post(`${b}/eligible-nodes`, data);
export const getDeliverySlots     = (params)        => api.get(`${b}/delivery-slots`, { params });
export const calculateCart        = (data)          => api.post(`${b}/calculate`, data);
export const createOrder          = (data)          => api.post(`${b}/create-order`, data);

// ── Création manuelle back-office (onglets Client / Nœud / Articles / Adresse / Créneaux) ──
export const searchNodeArticles   = (params)        => api.get(`${b}/articles`, { params });
export const searchNodePacks      = (params)        => api.get(`${b}/packs`, { params });
export const getCheckoutCities    = (search)        => api.get(`${b}/cities`, { params: { search } });
export const getNodeSummary       = (nodeId)        => api.get(`${b}/node-summary/${nodeId}`);
export const getNodeSlots         = (params)        => api.get(`${b}/node-slots`, { params });
export const createCheckoutCustomer = (data)        => api.post(`${b}/customers`, data);
export const createCustomerAddress  = (customerId, data) => api.post(`${b}/customers/${customerId}/addresses`, data);
