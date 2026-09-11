import api from './axios';

const p = '/purchasing';

// ——— Référentiels ———
export const getPurchasingLookups = () => api.get(`${p}/lookups`);
export const searchPurchasingSkus = (search, limit = 15) => api.get(`${p}/lookups/skus`, { params: { search, limit } });

// ——— Fournisseurs ———
export const getSuppliers = (params) => api.get(`${p}/suppliers`, { params });
export const getSupplier = (id) => api.get(`${p}/suppliers/${id}`);
export const createSupplier = (data) => api.post(`${p}/suppliers`, data);
export const updateSupplier = (id, data) => api.put(`${p}/suppliers/${id}`, data);
export const toggleSupplierStatus = (id) => api.patch(`${p}/suppliers/${id}/toggle-status`);
export const deleteSupplier = (id) => api.delete(`${p}/suppliers/${id}`);
export const restoreSupplier = (id) => api.patch(`${p}/suppliers/${id}/restore`);

// ——— Prix fournisseurs (fournisseur × SKU) ———
export const getSupplierPrices = (params) => api.get(`${p}/supplier-prices`, { params });
export const getBestSupplierPrice = (params) => api.get(`${p}/supplier-prices/best`, { params });
export const createSupplierPrice = (data) => api.post(`${p}/supplier-prices`, data);
export const renegotiateSupplierPrice = (id, data) => api.post(`${p}/supplier-prices/${id}/renegotiate`, data);
export const updateSupplierPrice = (id, data) => api.put(`${p}/supplier-prices/${id}`, data);
export const deactivateSupplierPrice = (id) => api.delete(`${p}/supplier-prices/${id}`);

// ——— Bons de commande ———
export const getPurchaseOrders = (params) => api.get(`${p}/purchase-orders`, { params });
export const getPurchaseOrder = (id) => api.get(`${p}/purchase-orders/${id}`);
export const createPurchaseOrder = (data) => api.post(`${p}/purchase-orders`, data);
export const updatePurchaseOrder = (id, data) => api.put(`${p}/purchase-orders/${id}`, data);
export const changePurchaseOrderStatus = (id, status, reason) =>
  api.post(`${p}/purchase-orders/${id}/status`, { status, ...(reason ? { reason } : {}) });
export const cancelPurchaseOrder = (id, reason) => api.post(`${p}/purchase-orders/${id}/cancel`, { reason });
export const deletePurchaseOrder = (id) => api.delete(`${p}/purchase-orders/${id}`);
export const receivePurchaseOrder = (id, data) => api.post(`${p}/purchase-orders/${id}/receive`, data);
