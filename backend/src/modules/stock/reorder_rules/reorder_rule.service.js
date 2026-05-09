const repo   = require('./reorder_rule.repository');
const prisma = require('../../../config/database');

const N = (v) => Number(v ?? 0);

class ReorderRuleService {
  // ─── Queries ─────────────────────────────────────────────────────────────────

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
    if (!rule) throw { statusCode: 404, message: 'Règle de réapprovisionnement introuvable' };
    return rule;
  }

  async getRefs() {
    return repo.getRefs();
  }

  // ─── Validation helper ────────────────────────────────────────────────────────

  _validate(body, requireRequired = true) {
    const {
      node_id, sku_id,
      safety_stock, reorder_point, economic_qty, max_stock, lead_time_days,
      costing_method_id,
    } = body;

    if (requireRequired) {
      if (!node_id)           throw { statusCode: 400, message: 'node_id requis' };
      if (!sku_id)            throw { statusCode: 400, message: 'sku_id requis' };
      if (!costing_method_id) throw { statusCode: 400, message: 'costing_method_id requis' };
    }

    const data = {};

    if (safety_stock !== undefined) {
      const v = N(safety_stock);
      if (v < 0) throw { statusCode: 400, message: 'safety_stock doit être >= 0' };
      data.safety_stock = v;
    }
    if (reorder_point !== undefined) {
      const v = N(reorder_point);
      if (v < 0) throw { statusCode: 400, message: 'reorder_point doit être >= 0' };
      data.reorder_point = v;
    }
    if (economic_qty !== undefined) {
      const v = N(economic_qty);
      if (v < 0) throw { statusCode: 400, message: 'economic_qty doit être >= 0' };
      data.economic_qty = v;
    }
    if (max_stock !== undefined) {
      data.max_stock = max_stock === null || max_stock === '' ? null : N(max_stock);
    }
    if (lead_time_days !== undefined) {
      const v = parseInt(lead_time_days, 10);
      if (isNaN(v) || v < 0) throw { statusCode: 400, message: 'lead_time_days doit être >= 0' };
      data.lead_time_days = v;
    }
    if (costing_method_id !== undefined) data.costing_method_id    = costing_method_id;
    if (body.preferred_supplier_id !== undefined)
      data.preferred_supplier_id = body.preferred_supplier_id || null;
    if (body.is_active !== undefined) data.is_active = Boolean(body.is_active);

    // Cross-field: max_stock >= reorder_point
    const rp = data.reorder_point ?? N(body.reorder_point);
    const ms = data.max_stock;
    if (ms !== null && ms !== undefined && rp !== undefined && ms < rp)
      throw { statusCode: 400, message: 'max_stock doit être >= reorder_point' };

    return data;
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  async create(body) {
    const data = this._validate(body, true);
    return repo.upsert(body.node_id, body.sku_id, data);
  }

  async updateById(id, body) {
    await this.getById(id);
    const data = this._validate(body, false);
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
      const { node_id, sku_id, costing_method_id } = row;
      if (!node_id)           throw { statusCode: 400, message: `Ligne ${i + 1} : node_id requis` };
      if (!sku_id)            throw { statusCode: 400, message: `Ligne ${i + 1} : sku_id requis` };
      if (!costing_method_id) throw { statusCode: 400, message: `Ligne ${i + 1} : costing_method_id requis` };

      const data = this._validate(row, false);
      return { node_id, sku_id, costing_method_id, ...data };
    });

    return repo.bulkSave(validated);
  }

  // ─── Business logic ──────────────────────────────────────────────────────────

  async shouldReorder(body) {
    const { node_id, sku_id } = body;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    return repo.shouldReorder(node_id, sku_id);
  }

  async detectCritical(body) {
    const { node_id, sku_id } = body;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    return repo.detectCriticalStock(node_id, sku_id);
  }

  async detectOverstock(body) {
    const { node_id, sku_id } = body;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    return repo.detectOverstock(node_id, sku_id);
  }

  async suggestedQty(query) {
    const { node_id, sku_id } = query;
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    return repo.calculateSuggestedReorderQty(node_id, sku_id);
  }
}

module.exports = new ReorderRuleService();
