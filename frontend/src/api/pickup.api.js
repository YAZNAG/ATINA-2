import api from './axios';

// ── Liste des commandes ready + pickup ────────────────────────────────────────
export const getPickupOrders = (params) =>
  api.get('/orders-mgmt', {
    params: { status_code: 'ready', delivery_type_code: 'pickup', limit: 100, ...params },
  });

// ── Détail commande ───────────────────────────────────────────────────────────
export const getPickupOrder = (id) => api.get(`/orders-mgmt/${id}`);

// ── Confirmer le retrait (décrémente stock, passe à delivered) ────────────────
export const confirmPickup = (id, data) =>
  api.patch(`/orders-mgmt/${id}/confirm-pickup`, data ?? {});
