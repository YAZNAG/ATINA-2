import api from './axios';

const r = '/reporting';

// ── Référentiels de filtres (nodes, régions, familles, catégories, marques, statuts) ──
export const getReportingFilters = () => api.get(`${r}/filters`);

// ── KPI Overview (écran d'accueil) ──
// params : period=day|week|month ou from/to (AAAA-MM-JJ), node_id, region_id, status
export const getOverview = (params) => api.get(`${r}/overview`, { params });
export const getOverviewOrders = (params) => api.get(`${r}/overview/orders`, { params });
export const getOverviewStock = (params) => api.get(`${r}/overview/stock`, { params });
export const getOverviewPreparation = (params) => api.get(`${r}/overview/preparation`, { params });

// ── Distribution Stock ──
// params : node_id, region_id, family_id, category_id, brand_id, search, coverage_threshold
export const getCoverageByNode = (params) => api.get(`${r}/stock-distribution/nodes`, { params });
export const getCoverageBySku = (params) => api.get(`${r}/stock-distribution/skus`, { params });
export const getStockAlerts = (params) => api.get(`${r}/stock-distribution/alerts`, { params });
export const getStockMatrix = (params) => api.get(`${r}/stock-distribution/matrix`, { params });
export const getStockDetail = (params) => api.get(`${r}/stock-distribution/detail`, { params });

// ── Endpoints historiques ──
export const getDashboardSummary = (params) => api.get(`${r}/dashboard`, { params });
