import api from './axios';

const base = '/gamification';

// ——— Référentiels ———
export const getGamificationLookups = () => api.get(`${base}/lookups`);
export const getNodePacks = (nodeId) => api.get(`${base}/nodes/${nodeId}/packs`);
export const searchNodeSkus = (nodeId, search) => api.get(`${base}/nodes/${nodeId}/skus`, { params: { search } });

// ——— Jeux ———
export const getGames = (params) => api.get(`${base}/games`, { params });
export const getGame = (id) => api.get(`${base}/games/${id}`);
export const createGame = (data) => api.post(`${base}/games`, data);
export const updateGame = (id, data) => api.put(`${base}/games/${id}`, data);
export const activateGame = (id) => api.post(`${base}/games/${id}/activate`);
export const deactivateGame = (id) => api.post(`${base}/games/${id}/deactivate`);
export const getGameDeleteCheck = (id) => api.get(`${base}/games/${id}/delete-check`);
export const deleteGame = (id) => api.delete(`${base}/games/${id}`);

// ——— Lots d'un jeu ———
export const addPrize = (gameId, data) => api.post(`${base}/games/${gameId}/prizes`, data);
export const updatePrize = (gameId, prizeId, data) => api.put(`${base}/games/${gameId}/prizes/${prizeId}`, data);
export const deletePrize = (gameId, prizeId) => api.delete(`${base}/games/${gameId}/prizes/${prizeId}`);

// ——— Participations (lecture seule) ———
export const getPlays = (params) => api.get(`${base}/plays`, { params });
export const exportPlays = (params) => api.get(`${base}/plays/export`, { params });
export const getPlay = (id) => api.get(`${base}/plays/${id}`);
