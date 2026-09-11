const { audit } = require('../../../utils/audit');
const repo   = require('./stock_level.repository');
const prisma = require('../../../config/database');
const skuCost = require('../sku_costs/sku_cost.util');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class StockLevelService {
  // ─── Queries ────────────────────────────────────────────────────────────────

  async getWithFilters(params) {
    const { node_id } = params;
    if (node_id) {
      const node = await prisma.node.findFirst({ where: { id: node_id, is_active: true, is_deleted: false } });
      if (!node) throw { statusCode: 404, message: 'Entrepôt introuvable ou inactif' };
    }
    return repo.findWithFilters(params);
  }

  async getByNode(node_id) {
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    return this.getWithFilters({ node_id });
  }

  /** CUMP courant, valeur du stock (qty_physical × CUMP) et historique des snapshots d'un couple. */
  async getCost({ node_id, sku_id, limit } = {}) {
    if (!UUID_RE.test(String(node_id || ''))) throw { statusCode: 400, message: 'node_id requis (identifiant valide)' };
    if (!UUID_RE.test(String(sku_id || ''))) throw { statusCode: 400, message: 'sku_id requis (identifiant valide)' };
    return skuCost.costSummary({ node_id, sku_id, limit });
  }

  async getById(id) {
    const level = await repo.findById(id);
    if (!level) throw { statusCode: 404, message: 'Niveau de stock introuvable' };
    return level;
  }

  async getAllBySku(sku_id) {
  if (!sku_id) throw { statusCode: 400, message: 'sku_id requis' };
  return repo.findAllBySku(sku_id);
}

  // ─── Business operations ─────────────────────────────────────────────────────

  async receipt(body) {
    const { node_id, sku_id, qty, move_type_id, reference } = body;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    const q = Number(qty);
    if (isNaN(q) || q <= 0) throw { statusCode: 400, message: 'qty doit être > 0' };
    return repo.applyReceipt(node_id, sku_id, q, move_type_id, reference);
  }

  async reserve(body) {
    const { node_id, sku_id, qty } = body;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    const q = Number(qty);
    if (isNaN(q) || q <= 0) throw { statusCode: 400, message: 'qty doit être > 0' };
    return repo.reserveForOrder(node_id, sku_id, q);
  }

  async picking(body) {
    const { node_id, sku_id, qty, move_type_id } = body;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    const q = Number(qty);
    if (isNaN(q) || q <= 0) throw { statusCode: 400, message: 'qty doit être > 0' };
    return repo.completePicking(node_id, sku_id, q, move_type_id);
  }

  async cancel(body) {
    const { node_id, sku_id, qty, is_backorder } = body;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    const q = Number(qty);
    if (isNaN(q) || q <= 0) throw { statusCode: 400, message: 'qty doit être > 0' };
    return repo.cancelReservation(node_id, sku_id, q, !!is_backorder);
  }

  async incoming(body) {
    const { node_id, sku_id, qty_delta } = body;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    const delta = Number(qty_delta);
    if (isNaN(delta)) throw { statusCode: 400, message: 'qty_delta invalide' };
    return repo.updateIncoming(node_id, sku_id, delta);
  }

  async codDelivered(body) {
    const { node_id, sku_id, qty } = body;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    const q = Number(qty);
    if (isNaN(q) || q <= 0) throw { statusCode: 400, message: 'qty doit être > 0' };
    return repo.confirmCODDelivered(node_id, sku_id, q);
  }

  async codCollected(body) {
    const { node_id, sku_id, qty } = body;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    const q = Number(qty);
    if (isNaN(q) || q <= 0) throw { statusCode: 400, message: 'qty doit être > 0' };
    return repo.confirmCODCollected(node_id, sku_id, q);
  }

  async count(body) {
    const { node_id, sku_id } = body;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    return repo.updateLastCountedAt(node_id, sku_id);
  }

  async adjust(body, req = null) {
    const { node_id, sku_id, qty_physical, move_type_id, reference } = body;
    const reason = String(body.reason ?? reference ?? '').trim();
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    if (!reason)  throw { statusCode: 400, message: "Le motif de l'ajustement est obligatoire" };
    const qty = Number(qty_physical);
    if (isNaN(qty) || qty < 0) throw { statusCode: 400, message: 'qty_physical doit être >= 0' };
    const result = await repo.adminAdjust(node_id, sku_id, qty, move_type_id, reference || reason, {
      operator_id: req?.user?.id ?? null,
      reason,
    });
    await audit(req, {
      action: 'ADJUST',
      resource: 'stock_levels',
      resource_id: `${node_id}:${sku_id}`,
      old_values: { qty_physical: result.qty_physical_before },
      new_values: { qty_physical: qty, qty_delta: result.qty_delta, reason, move_id: result.move.id },
    });
    return result;
  }

  async recalculate(body) {
    return repo.recalculate(body?.node_id);
  }

  // Legacy generic move
  async applyMove(body) {
    const { node_id, sku_id, qty_delta, move_type_id, reference, metadata } = body;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    const delta = Number(qty_delta);
    if (isNaN(delta) || delta === 0) throw { statusCode: 400, message: 'qty_delta doit être non nul' };
    return repo.applyMove(node_id, sku_id, delta, move_type_id, reference, metadata);
  }

  async getMoves(params) {
  const { node_id, sku_id } = params;
  if (!node_id && !sku_id) throw { statusCode: 400, message: 'node_id ou sku_id requis' };
  return repo.findMoves(params);
}
}

module.exports = new StockLevelService();
