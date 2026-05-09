const repo   = require('./selling_rule.repository');
const prisma = require('../../../config/database');

class SellingRuleService {
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
    const rule = await repo.findById(id);
    if (!rule) throw { statusCode: 404, message: 'Règle de vente introuvable' };
    return rule;
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async upsert(body) {
    const { node_id, sku_id, is_backorderable, backorder_limit, estimated_restock_days } = body;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };

    const data = {};
    if (is_backorderable !== undefined) data.is_backorderable = Boolean(is_backorderable);

    if (backorder_limit !== undefined) {
      const v = Number(backorder_limit);
      if (isNaN(v) || v < 0) throw { statusCode: 400, message: 'backorder_limit doit être >= 0' };
      data.backorder_limit = v;
    }
    if (estimated_restock_days !== undefined) {
      const v = parseInt(estimated_restock_days, 10);
      if (isNaN(v) || v < 0) throw { statusCode: 400, message: 'estimated_restock_days doit être >= 0' };
      data.estimated_restock_days = v;
    }

    return repo.upsert(node_id, sku_id, data);
  }

  async updateById(id, body) {
    await this.getById(id);
    const { is_backorderable, backorder_limit, estimated_restock_days } = body;
    const data = {};

    if (is_backorderable !== undefined) data.is_backorderable = Boolean(is_backorderable);
    if (backorder_limit !== undefined) {
      const v = Number(backorder_limit);
      if (isNaN(v) || v < 0) throw { statusCode: 400, message: 'backorder_limit doit être >= 0' };
      data.backorder_limit = v;
    }
    if (estimated_restock_days !== undefined) {
      const v = parseInt(estimated_restock_days, 10);
      if (isNaN(v) || v < 0) throw { statusCode: 400, message: 'estimated_restock_days doit être >= 0' };
      data.estimated_restock_days = v;
    }

    return repo.update(id, data);
  }

  async remove(id) {
    await this.getById(id);
    return repo.remove(id);
  }

  async bulkSave(rows) {
    if (!Array.isArray(rows) || rows.length === 0)
      throw { statusCode: 400, message: 'rows doit être un tableau non vide' };

    const validated = rows.map((row, i) => {
      const { node_id, sku_id, is_backorderable, backorder_limit, estimated_restock_days } = row;
      if (!node_id) throw { statusCode: 400, message: `Ligne ${i + 1} : node_id requis` };
      if (!sku_id)  throw { statusCode: 400, message: `Ligne ${i + 1} : sku_id requis` };

      const bl = Number(backorder_limit ?? 0);
      const rd = parseInt(estimated_restock_days ?? 1, 10);
      if (isNaN(bl) || bl < 0) throw { statusCode: 400, message: `Ligne ${i + 1} : backorder_limit >= 0` };
      if (isNaN(rd) || rd < 0) throw { statusCode: 400, message: `Ligne ${i + 1} : estimated_restock_days >= 0` };

      return {
        node_id, sku_id,
        is_backorderable:      is_backorderable !== undefined ? Boolean(is_backorderable) : true,
        backorder_limit:       bl,
        estimated_restock_days: rd,
      };
    });

    return repo.bulkSave(validated);
  }

  // ─── Business logic ──────────────────────────────────────────────────────────

  async canSell(body) {
    const { node_id, sku_id, qty } = body;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    const q = Number(qty ?? 1);
    if (isNaN(q) || q <= 0) throw { statusCode: 400, message: 'qty doit être > 0' };
    return repo.canSellSKU(node_id, sku_id, q);
  }

  async reserveBackorder(body) {
    const { node_id, sku_id, qty } = body;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    const q = Number(qty);
    if (isNaN(q) || q <= 0) throw { statusCode: 400, message: 'qty doit être > 0' };
    return repo.reserveBackorder(node_id, sku_id, q);
  }

  async releaseBackorder(body) {
    const { node_id, sku_id, qty } = body;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    const q = Number(qty);
    if (isNaN(q) || q <= 0) throw { statusCode: 400, message: 'qty doit être > 0' };
    return repo.releaseBackorder(node_id, sku_id, q);
  }

  async estimatedDelivery(query) {
    const { node_id, sku_id } = query;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    return repo.calculateEstimatedDelivery(node_id, sku_id);
  }
}

module.exports = new SellingRuleService();
