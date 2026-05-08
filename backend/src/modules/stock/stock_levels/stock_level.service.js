const repo   = require('./stock_level.repository');
const prisma = require('../../../config/database');

class StockLevelService {
  async getByNode(node_id) {
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    const node = await prisma.node.findFirst({
      where: { id: node_id, is_active: true, is_deleted: false },
    });
    if (!node) throw { statusCode: 404, message: 'Entrepôt introuvable ou inactif' };
    return repo.findByNode(node_id);
  }

  async applyMove(body) {
    const { node_id, sku_id, qty_delta, move_type_id, reference, metadata } = body;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    const delta = Number(qty_delta);
    if (isNaN(delta) || delta === 0) throw { statusCode: 400, message: 'qty_delta must be a non-zero number' };
    return repo.applyMove(node_id, sku_id, delta, move_type_id, reference, metadata);
  }

  async adjust(body) {
    const { node_id, sku_id, qty_physical, move_type_id, reference } = body;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    const qty = Number(qty_physical);
    if (isNaN(qty) || qty < 0) throw { statusCode: 400, message: 'qty_physical doit être >= 0' };
    return repo.adminAdjust(node_id, sku_id, qty, move_type_id, reference);
  }
}

module.exports = new StockLevelService();
