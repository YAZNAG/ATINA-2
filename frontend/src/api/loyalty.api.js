import api from './axios';

const b = '/loyalty';

// Référentiels (types de règle, types de récompense, types de promo, statuts, catégories, types de transaction)
export const getLoyaltyMeta = () => api.get(`${b}/meta`);

// Configuration des points (points_rules)
export const getPointsRules = (params) => api.get(`${b}/points-rules`, { params });
export const getPointsRule = (id) => api.get(`${b}/points-rules/${id}`);
export const createPointsRule = (body) => api.post(`${b}/points-rules`, body);
export const updatePointsRule = (id, body) => api.put(`${b}/points-rules/${id}`, body);
export const activatePointsRule = (id) => api.patch(`${b}/points-rules/${id}/activate`);
export const deactivatePointsRule = (id) => api.patch(`${b}/points-rules/${id}/deactivate`);
export const deletePointsRule = (id) => api.delete(`${b}/points-rules/${id}`);

// Livre des points (keyset : params.cursor)
export const getPointsLedger = (params) => api.get(`${b}/ledger`, { params });
export const exportPointsLedger = (params) => api.get(`${b}/ledger/export`, { params });
export const getPointsTransaction = (id) => api.get(`${b}/ledger/${id}`);
// Rapprochement SUM(points) du livre / customers.points_balance (écarts journalisés dans l'audit)
export const runPointsReconciliation = () => api.post(`${b}/reconciliation/run`);

// Parrainage : configurations
export const getReferralConfigs = () => api.get(`${b}/referral-configs`);
export const getReferralConfig = (id) => api.get(`${b}/referral-configs/${id}`);
export const createReferralConfig = (body) => api.post(`${b}/referral-configs`, body);
export const updateReferralConfig = (id, body) => api.put(`${b}/referral-configs/${id}`, body);
export const activateReferralConfig = (id) => api.patch(`${b}/referral-configs/${id}/activate`);
export const deactivateReferralConfig = (id) => api.patch(`${b}/referral-configs/${id}/deactivate`);

// Parrainage : suivi
export const getReferralsList = (params) => api.get(`${b}/referrals`, { params });
export const exportReferrals = (params) => api.get(`${b}/referrals/export`, { params });
export const getReferral = (id) => api.get(`${b}/referrals/${id}`);

// Fiche client
export const getCustomerLedger = (customerId, params) => api.get(`${b}/customers/${customerId}/ledger`, { params });
export const exportCustomerLedger = (customerId, params) => api.get(`${b}/customers/${customerId}/ledger/export`, { params });
export const adjustCustomerPoints = (customerId, body) => api.post(`${b}/customers/${customerId}/adjust`, body);
export const getCustomerReferrals = (customerId, params) => api.get(`${b}/customers/${customerId}/referrals`, { params });
