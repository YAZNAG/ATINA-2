const repo   = require('./stock_move.repository');
const prisma = require('../../../config/database');

class StockMoveService {
  async getWithFilters(params) {
    const { node_id, sku_id } = params;
    if (!node_id && !sku_id) throw { statusCode: 400, message: 'node_id ou sku_id requis' };
    if (node_id) {
      const node = await prisma.node.findFirst({ where: { id: node_id, is_active: true, is_deleted: false } });
      if (!node) throw { statusCode: 404, message: 'Nœud introuvable ou inactif' };
    }
    return repo.findWithFilters(params);
  }

  async getById(id) {
    const move = await repo.findById(id);
    if (!move) throw { statusCode: 404, message: 'Mouvement introuvable' };
    return move;
  }

  async getStats(node_id) {
    return repo.getStats(node_id);
  }
}

module.exports = new StockMoveService();