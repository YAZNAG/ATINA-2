import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { CONFIG } from '../constants/config';
import { getNodeId } from '../store/nodePref';
import { getLang, localizeData } from '../i18n';

const api = axios.create({
  baseURL: CONFIG.API_URL,
  timeout: CONFIG.TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Point de distribution choisi (catalogue, prix, stock du node) et langue des messages serveur.
  const nodeId = await getNodeId();
  if (nodeId && !config.headers['X-Node-Id']) config.headers['X-Node-Id'] = nodeId;
  config.headers['X-Lang'] = getLang();
  return config;
});

api.interceptors.response.use(
  (response) => { response.data = localizeData(response.data); return response; },
  (error) => {
    const message = error.response?.data?.message || 'Erreur réseau';
    const statusCode = error.response?.status || 500;
    return Promise.reject({ message, statusCode });
  }
);

export default api;