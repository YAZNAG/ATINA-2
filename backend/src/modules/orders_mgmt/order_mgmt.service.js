const repo = require('./order_mgmt.repository');

// ── Status transition rules ───────────────────────────────────────────────────
const TRANSITIONS = {
  pending:        ['confirmed', 'cancelled'],
  awaiting_stock: ['confirmed', 'cancelled'],
  confirmed:      ['picking',   'cancelled'],
  picking:        ['ready',     'cancelled'],
  ready:          ['in_delivery','cancelled'],
  in_delivery:    ['delivered', 'cancelled', 'returned'],
};

const STATUS_LABELS = {
  confirmed:   'Confirmer',
  picking:     'Lancer picking',
  ready:       'Marquer prête',
  in_delivery: 'Lancer livraison',
  delivered:   'Marquer livrée',
  cancelled:   'Annuler',
  returned:    'Retourner',
};

class OrderMgmtService {
  async list(params) {
    const page  = Math.max(1, parseInt(params.page  || 1));
    const limit = Math.min(100, Math.max(1, parseInt(params.limit || 25)));
    const { data, total } = await repo.findAll({ ...params, page, limit });
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const order = await repo.findById(id);
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
    return order;
  }

  async getTransitions(id) {
    const order = await repo.findById(id);
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
    const allowed = TRANSITIONS[order.status.code] ?? [];
    return allowed.map(code => ({ code, label: STATUS_LABELS[code] ?? code }));
  }

  async changeStatus(id, new_status_code, changed_by = null) {
    const order = await repo.findById(id);
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
    if (order.status.is_terminal)
      throw { statusCode: 422, message: `Statut "${order.status.name_fr}" est terminal — aucune transition possible` };

    const allowed = TRANSITIONS[order.status.code] ?? [];
    if (!allowed.includes(new_status_code))
      throw { statusCode: 422, message: `Transition "${order.status.code}" → "${new_status_code}" non autorisée. Transitions valides: ${allowed.join(', ') || 'aucune'}` };

    const newStatus = await repo.getStatusByCode(new_status_code);
    if (!newStatus) throw { statusCode: 404, message: `Statut "${new_status_code}" introuvable en base` };

    return repo.updateStatus(id, newStatus.id, changed_by);
  }

  async cancel(id, reason, changed_by = null) {
    return this.changeStatus(id, 'cancelled', changed_by);
  }

  async getHistory(id) {
    const order = await repo.findById(id);
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
    return repo.getHistory(id);
  }

  async meta() {
    const [statusCounts, nodes, deliveryTypes] = await Promise.all([
      repo.countByStatus(),
      repo.getNodes(),
      repo.getDeliveryTypes(),
    ]);
    return { status_counts: statusCounts, nodes, delivery_types: deliveryTypes };
  }
}

module.exports = new OrderMgmtService();
