const repo   = require('./reorder_rule.repository');
const prisma = require('../../../config/database');
const { audit } = require('../../../utils/audit');

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
  //
  // Contrôles WF#8 / US-048 :
  //   safety_stock ≥ 0 ; reorder_point ≥ safety_stock ; economic_qty > 0 ;
  //   max_stock (NULL = pas de plafond) ≥ reorder_point si renseigné ; lead_time_days ≥ 0.
  // `existing` = règle actuelle (mise à jour partielle) : les contrôles croisés
  // portent sur les valeurs fusionnées (nouvelles valeurs ∪ valeurs existantes).

  _num(v, label) {
    const n = Number(v);
    if (v === '' || v === null || !Number.isFinite(n)) throw { statusCode: 400, message: `${label} : valeur numérique invalide` };
    return n;
  }

  _validate(body, requireRequired = true, existing = null, prefix = '') {
    const {
      node_id, sku_id,
      safety_stock, reorder_point, economic_qty, max_stock, lead_time_days,
      costing_method_id,
    } = body;
    const P = prefix;

    if (requireRequired) {
      if (!node_id)           throw { statusCode: 400, message: `${P}Node obligatoire` };
      if (!sku_id)            throw { statusCode: 400, message: `${P}SKU obligatoire` };
      if (!costing_method_id) throw { statusCode: 400, message: `${P}Méthode de valorisation obligatoire` };
      if (reorder_point === undefined || reorder_point === null || reorder_point === '')
        throw { statusCode: 400, message: `${P}Point de réapprovisionnement obligatoire` };
      if (economic_qty === undefined || economic_qty === null || economic_qty === '')
        throw { statusCode: 400, message: `${P}Quantité économique de commande obligatoire` };
    }

    const data = {};

    if (safety_stock !== undefined) {
      const v = this._num(safety_stock, `${P}Stock de sécurité`);
      if (v < 0) throw { statusCode: 400, message: `${P}Le stock de sécurité doit être ≥ 0` };
      data.safety_stock = v;
    }
    if (reorder_point !== undefined) {
      const v = this._num(reorder_point, `${P}Point de réappro`);
      if (v < 0) throw { statusCode: 400, message: `${P}Le point de réapprovisionnement doit être ≥ 0` };
      data.reorder_point = v;
    }
    if (economic_qty !== undefined) {
      const v = this._num(economic_qty, `${P}Quantité économique`);
      if (v <= 0) throw { statusCode: 400, message: `${P}La quantité économique de commande doit être > 0` };
      data.economic_qty = v;
    }
    if (max_stock !== undefined) {
      data.max_stock = max_stock === null || max_stock === '' ? null : this._num(max_stock, `${P}Stock maximum`);
      if (data.max_stock !== null && data.max_stock < 0) throw { statusCode: 400, message: `${P}Le stock maximum doit être ≥ 0` };
    }
    if (lead_time_days !== undefined) {
      const v = parseInt(lead_time_days, 10);
      if (isNaN(v) || v < 0 || v > 32767) throw { statusCode: 400, message: `${P}Le délai fournisseur doit être un nombre de jours ≥ 0` };
      data.lead_time_days = v;
    }
    if (costing_method_id !== undefined) {
      if (!costing_method_id) throw { statusCode: 400, message: `${P}Méthode de valorisation obligatoire` };
      data.costing_method_id = costing_method_id;
    }
    if (body.preferred_supplier_id !== undefined)
      data.preferred_supplier_id = body.preferred_supplier_id || null;
    if (body.is_active !== undefined) data.is_active = body.is_active === true || body.is_active === 'true' || body.is_active === 1;

    // Contrôles croisés sur les valeurs fusionnées (uniquement si un seuil est modifié)
    const touchesThresholds = ['safety_stock', 'reorder_point', 'economic_qty', 'max_stock']
      .some((k) => data[k] !== undefined);
    if (touchesThresholds || requireRequired) {
      const pick = (k, def) => (data[k] !== undefined ? data[k] : (existing && existing[k] != null ? N(existing[k]) : def));
      const ss = pick('safety_stock', 0);
      const rp = pick('reorder_point', 0);
      const eq = pick('economic_qty', 0);
      const ms = data.max_stock !== undefined ? data.max_stock : (existing?.max_stock != null ? N(existing.max_stock) : null);
      if (rp < ss) throw { statusCode: 400, message: `${P}Le point de réapprovisionnement (${rp}) doit être ≥ au stock de sécurité (${ss})` };
      if (!(eq > 0)) throw { statusCode: 400, message: `${P}La quantité économique de commande doit être > 0` };
      if (ms !== null && ms < rp) throw { statusCode: 400, message: `${P}Le stock maximum (${ms}) doit être ≥ au point de réapprovisionnement (${rp})` };
    }

    return data;
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  async create(body, req = null) {
    const data = this._validate(body, true);
    const before = await repo.findOne(body.node_id, body.sku_id);
    const rule = await repo.upsert(body.node_id, body.sku_id, data);
    await audit(req, {
      action: before ? 'UPDATE' : 'CREATE',
      resource: 'reorder_rules',
      resource_id: rule.id,
      old_values: before,
      new_values: { node_id: body.node_id, sku_id: body.sku_id, ...data },
    });
    return rule;
  }

  async updateById(id, body, req = null) {
    const existing = await this.getById(id);
    const data = this._validate(body, false, existing);
    const rule = await repo.update(id, data);
    await audit(req, {
      action: 'UPDATE',
      resource: 'reorder_rules',
      resource_id: id,
      old_values: existing,
      new_values: data,
    });
    return rule;
  }

  async remove(id, req = null) {
    const existing = await this.getById(id);
    const removed = await repo.remove(id);
    await audit(req, {
      action: 'DELETE',
      resource: 'reorder_rules',
      resource_id: id,
      old_values: existing,
    });
    return removed;
  }

  async bulkSave(rows, req = null) {
    if (!Array.isArray(rows) || rows.length === 0)
      throw { statusCode: 400, message: 'Aucune ligne à importer' };
    if (rows.length > 5000)
      throw { statusCode: 400, message: 'Import limité à 5000 lignes par fichier' };

    const validated = rows.map((row, i) => {
      // L'import CSV en masse envoie sku_code au lieu de sku_id — les deux sont
      // acceptés ici, la résolution sku_code -> sku_id se fait dans le repository.
      const { node_id, sku_id, sku_code, costing_method_id } = row;
      const P = `Ligne ${row.line ?? i + 1} : `;
      if (!node_id)             throw { statusCode: 400, message: `${P}node_id requis` };
      if (!sku_id && !sku_code) throw { statusCode: 400, message: `${P}sku_id ou sku_code requis` };
      if (!costing_method_id)   throw { statusCode: 400, message: `${P}méthode de valorisation requise` };

      const { line, ...clean } = row;
      const data = this._validate({ ...clean, sku_id: sku_id || 'pending' }, true, null, P);
      return { node_id, sku_id, sku_code, costing_method_id, ...data };
    });

    const saved = await repo.bulkSave(validated);
    await audit(req, {
      action: 'IMPORT',
      resource: 'reorder_rules',
      new_values: { count: saved.length },
    });
    return saved;
  }

  // ─── Alertes rupture (US-113) & seuils bruts ─────────────────────────────────

  async getAlerts(query) {
    const { status } = query;
    if (status && !['alerte', 'rupture'].includes(status))
      throw { statusCode: 400, message: "Filtre seuil invalide (attendu : 'alerte' ou 'rupture')" };
    return repo.findAlerts(query);
  }

  async getThresholds(query) {
    return repo.findPlain(query);
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