import api from './axios';

const w = '/wallet';

// ——— Wallet Transaction Types ———
export const getWalletTxnTypes     = (params) => api.get(`${w}/txn-types`, { params });
export const getWalletTxnTypesList = ()        => api.get(`${w}/txn-types`, { params: { all: true } });
export const getWalletTxnType      = (id)      => api.get(`${w}/txn-types/${id}`);
export const createWalletTxnType   = (data)    => api.post(`${w}/txn-types`, data);
export const updateWalletTxnType   = (id, data) => api.put(`${w}/txn-types/${id}`, data);
export const deleteWalletTxnType   = (id)      => api.delete(`${w}/txn-types/${id}`);
export const seedWalletTxnTypes    = ()        => api.post(`${w}/txn-types/seed`);
