import api from './axios';

/* ───────── Log & Audit (/admin/audit) — lecture seule ───────── */

const a = '/admin/audit';

// Journal d'audit — params : user_id, resource, action, resource_id, search, date_from, date_to, cursor, limit
export const getAuditLogs = (params) => api.get(`${a}/logs`, { params });
export const getAuditLogFacets = () => api.get(`${a}/logs/facets`);
export const getAuditLog = (id) => api.get(`${a}/logs/${id}`);
export const exportAuditLogs = (params) => api.get(`${a}/logs/export`, { params, responseType: 'blob' });

// Notifications (log) — params : event_code, channel_id, is_read, customer_id, search, date_from, date_to, cursor, limit
export const getNotificationLogs = (params) => api.get(`${a}/notifications`, { params });
export const getNotificationFacets = () => api.get(`${a}/notifications/facets`);
export const exportNotificationLogs = (params) => api.get(`${a}/notifications/export`, { params, responseType: 'blob' });

/* ───────── App Configs & Méthodes de paiement (/admin/settings) ───────── */

const s = '/admin/settings';

// Liste de clés FERMÉE (WF #41) : seule la valeur d'un paramètre existant se modifie.
export const getAppConfigs = (params) => api.get(`${s}/configs`, { params });
export const getConfigValueTypes = () => api.get(`${s}/configs/value-types`);
export const updateAppConfig = (id, data) => api.put(`${s}/configs/${id}`, data);

export const getAdminPaymentMethods = () => api.get(`${s}/payment-methods`);
export const createAdminPaymentMethod = (data) => api.post(`${s}/payment-methods`, data);
export const updateAdminPaymentMethod = (id, data) => api.put(`${s}/payment-methods/${id}`, data);
export const toggleAdminPaymentMethod = (id) => api.patch(`${s}/payment-methods/${id}/toggle-active`);

// Méthodes de paiement par node (WF #42) + synthèse méthodes × nodes
export const getNodePaymentMethods = (nodeId) => api.get(`${s}/nodes/${nodeId}/payment-methods`);
export const setNodePaymentMethod = (nodeId, methodId, is_active) =>
  api.patch(`${s}/nodes/${nodeId}/payment-methods/${methodId}`, { is_active });
export const getPaymentMethodMatrix = () => api.get(`${s}/payment-methods/matrix`);

export const getLookups = () => api.get(`${s}/lookups`);

/* ───────── Utilitaire : téléchargement d'un Blob (export CSV API) ───────── */

export const downloadBlob = (response, fallbackName) => {
  const disposition = response?.headers?.['content-disposition'] || '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const name = match ? match[1] : fallbackName;
  const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
