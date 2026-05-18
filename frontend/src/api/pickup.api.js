import api from './axios';

// ── Liste des commandes ready + pickup ────────────────────────────────────────
export const getPickupOrders = (params) =>
  api.get('/pickup/ready-orders', { params });

// ── Détail commande ───────────────────────────────────────────────────────────
export const getPickupOrder = (id) => api.get(`/pickup/orders/${id}`);

// ── Collecte COD au comptoir (étape 1 si COD) ─────────────────────────────────
export const collectCOD = (id, data) =>
  api.patch(`/pickup/orders/${id}/collect-cod`, data ?? {});

// ── Confirmer le retrait (étape 2 — décrémente stock, passe à delivered) ──────
export const confirmPickup = (id, data) =>
  api.patch(`/pickup/orders/${id}/confirm`, data ?? {});

// ── Annuler commande ready ────────────────────────────────────────────────────
export const cancelReadyPickup = (id, data) =>
  api.patch(`/pickup/orders/${id}/cancel`, data ?? {});
