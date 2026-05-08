const repo   = require('./stock_level.repository');
const prisma = require('../../../config/database');

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

  async getById(id) {
    const level = await repo.findById(id);
    if (!level) throw { statusCode: 404, message: 'Niveau de stock introuvable' };
    return level;
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

  async adjust(body) {
    const { node_id, sku_id, qty_physical, move_type_id, reference } = body;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    const qty = Number(qty_physical);
    if (isNaN(qty) || qty < 0) throw { statusCode: 400, message: 'qty_physical doit être >= 0' };
    return repo.adminAdjust(node_id, sku_id, qty, move_type_id, reference);
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
}

module.exports = new StockLevelService();
