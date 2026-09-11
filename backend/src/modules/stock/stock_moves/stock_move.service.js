const repo   = require('./stock_move.repository');
const prisma = require('../../../config/database');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class StockMoveService {
  // Liste lecture seule (append-only). Tous les filtres sont optionnels ;
  // la pagination (limit ≤ 5000) borne le volume retourné.
  async getWithFilters(params = {}) {
    const { node_id, sku_id, move_type_id, location_id, po_id } = params;
    for (const [k, v] of Object.entries({ node_id, sku_id, move_type_id, location_id, po_id })) {
      if (v && !UUID_RE.test(String(v))) throw { statusCode: 400, message: `Filtre ${k} invalide` };
    }
    if (node_id) {
      const node = await prisma.node.findFirst({ where: { id: node_id, is_deleted: false } });
      if (!node) throw { statusCode: 404, message: 'Nœud introuvable' };
    }
    for (const k of ['date_from', 'date_to']) {
      if (params[k] && isNaN(new Date(params[k]).getTime())) throw { statusCode: 400, message: `Date ${k === 'date_from' ? 'de début' : 'de fin'} invalide` };
    }
    return repo.findWithFilters(params);
  }

  async getById(id) {
    if (!UUID_RE.test(String(id || ''))) throw { statusCode: 404, message: 'Mouvement introuvable' };
    const move = await repo.findById(id);
    if (!move) throw { statusCode: 404, message: 'Mouvement introuvable' };
    return move;
  }

  async getStats(node_id) {
    return repo.getStats(node_id);
  }
}

module.exports = new StockMoveService();
