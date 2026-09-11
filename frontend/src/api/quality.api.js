import api from './axios';

const b = '/quality-checks';

// Liste filtrée : node_id, check_type_id | check_type, result ('ok'|'ko'), date_from, date_to, score_min, score_max, page, limit
export const getQualityChecks        = (params) => api.get(b, { params });
export const exportQualityChecks     = (params) => api.get(`${b}/export`, { params });
export const getQualityStats         = (params) => api.get(`${b}/stats`, { params });
export const getQualityCheck         = (id)     => api.get(`${b}/${id}`);
export const createQualityCheck      = (data)   => api.post(b, data);
export const getQualityLookups       = ()       => api.get(`${b}/lookups`);
export const getQualitySessionsLookup = (params) => api.get(`${b}/lookups/sessions`, { params });
