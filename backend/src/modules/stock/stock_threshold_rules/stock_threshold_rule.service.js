const repo   = require('./stock_threshold_rule.repository');
const prisma = require('../../../config/database');

const FIELDS = [
  'node_id', 'sku_id',
  'stock_minimum', 'stock_alert_threshold', 'stock_maximum',
  'reorder_quantity', 'auto_restock_enabled', 'is_active',
];

const toNum  = (v) => (v === undefined ? undefined : Number(v));
const toBool = (v) => (v === undefined ? undefined : v === true || v === 'true');

const pick = (data) => {
  const out = {};
  for (const k of FIELDS) if (data[k] !== undefined) out[k] = data[k];
  for (const k of ['stock_minimum', 'stock_alert_threshold', 'stock_maximum', 'reorder_quantity'])
    if (out[k] !== undefined) out[k] = toNum(out[k]);
  if (out.auto_restock_enabled !== undefined) out.auto_restock_enabled = toBool(out.auto_restock_enabled);
  if (out.is_active            !== undefined) out.is_active            = toBool(out.is_active);
  return out;
};

const validateThresholds = ({ stock_minimum, stock_alert_threshold, stock_maximum }) => {
  const min   = Number(stock_minimum         ?? 0);
  const alert = Number(stock_alert_threshold ?? 0);
  const max   = Number(stock_maximum         ?? 0);
  if (min < 0)      throw { statusCode: 400, message: 'stock_minimum doit être >= 0' };
  if (alert < min)  throw { statusCode: 400, message: "Le seuil d'alerte doit être >= au stock minimum" };
  if (max <= alert) throw { statusCode: 400, message: "Le stock maximum doit être > au seuil d'alerte" };
};

class StockThresholdService {
  async getByNode(node_id) {
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    const node = await prisma.node.findFirst({ where: { id: node_id, is_active: true, is_deleted: false } });
    if (!node) throw { statusCode: 404, message: 'Entrepôt introuvable ou inactif' };
    return repo.findByNode(node_id);
  }

  async create(data) {
    const payload = pick(data);
    if (!payload.node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!payload.sku_id)  throw { statusCode: 400, message: 'sku_id requis' };
    validateThresholds(payload);
    const exists = await repo.findByNodeSku(payload.node_id, payload.sku_id);
    if (exists) throw { statusCode: 409, message: 'Une règle existe déjà pour ce SKU dans cet entrepôt' };
    return repo.create(payload);
  }

  async update(id, data) {
    const rule = await repo.findById(id);
    if (!rule) throw { statusCode: 404, message: 'Règle de seuil introuvable' };
    const payload = pick(data);
    validateThresholds({
      stock_minimum:         payload.stock_minimum         ?? Number(rule.stock_minimum),
      stock_alert_threshold: payload.stock_alert_threshold ?? Number(rule.stock_alert_threshold),
      stock_maximum:         payload.stock_maximum         ?? Number(rule.stock_maximum),
    });
    return repo.update(id, payload);
  }

  async delete(id) {
    const rule = await repo.findById(id);
    if (!rule) throw { statusCode: 404, message: 'Règle de seuil introuvable' };
    await repo.remove(id);
  }

  async bulkSave(node_id, rows) {
    if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
    if (!Array.isArray(rows) || rows.length === 0)
      throw { statusCode: 400, message: 'rows[] requis et non vide' };
    for (const r of rows) {
      if (!r.sku_id) throw { statusCode: 400, message: 'sku_id requis dans chaque ligne' };
      validateThresholds(r);
    }
    const processed = rows.map((r) => ({
      sku_id:               r.sku_id,
      stock_minimum:         toNum(r.stock_minimum),
      stock_alert_threshold: toNum(r.stock_alert_threshold),
      stock_maximum:         toNum(r.stock_maximum),
      reorder_quantity:      toNum(r.reorder_quantity ?? 0),
      auto_restock_enabled:  toBool(r.auto_restock_enabled ?? false),
      is_active:             toBool(r.is_active ?? true),
    }));
    return repo.bulkUpsert(node_id, processed);
  }
}

module.exports = new StockThresholdService();
