import axios from 'axios';

// Clés localStorage — séparées de l'admin ('token') et customer
const TOKEN_KEY = 'picker_token';
const USER_KEY  = 'picker_user';

// Instance Axios dédiée au picker portal
const pickerApi = axios.create({
  baseURL: '/api/picker',
  headers: { 'Content-Type': 'application/json' },
});

pickerApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

pickerApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.location.href = '/picker/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth — PUBLIC, utilise la même instance (pas de token requis sur /login) ──
export const pickerLogin = (data) => pickerApi.post('/login', data);

// ── Commandes ─────────────────────────────────────────────────────────────────
export const getAvailableOrders = ()        => pickerApi.get('/available-orders');
export const getMyOrders        = ()        => pickerApi.get('/my-orders');
export const acceptOrder        = (id)      => pickerApi.post(`/orders/${id}/accept`);

// ── Sessions ──────────────────────────────────────────────────────────────────
export const getSession      = (id) => pickerApi.get(`/sessions/${id}`);
export const startSession    = (id) => pickerApi.patch(`/sessions/${id}/start`);
export const completeSession = (id) => pickerApi.patch(`/sessions/${id}/complete`);

// ── Items ─────────────────────────────────────────────────────────────────────
export const pickItem       = (id, data) => pickerApi.patch(`/items/${id}/pick`, data);
export const outOfStock     = (id)       => pickerApi.patch(`/items/${id}/out-of-stock`);
export const substituteItem = (id, data) => pickerApi.patch(`/items/${id}/substitute`, data);

export default pickerApi;
