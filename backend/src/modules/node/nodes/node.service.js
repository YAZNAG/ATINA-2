const prisma = require('../../../config/database');
const repo = require('./node.repository');
const { audit } = require('../../../utils/audit');

// Champs éditables d'un node (whitelist : tout autre champ envoyé est ignoré).
const FIELDS = [
  'code', 'name_fr', 'name_ar', 'node_type_id', 'region_id', 'city_id',
  'address_line1', 'quartier', 'postal_code', 'lat', 'lng', 'phone', 'timezone',
  'delivery_radius_km', 'max_daily_orders', 'opening_hours_json', 'is_active',
  'delivery_fee', 'min_order_amount', 'slot_selection_enabled',
];

// Alias hérités de certains formulaires front.
const ALIASES = {
  phone_number: 'phone',
  address: 'address_line1',
  allow_customer_slot_selection: 'slot_selection_enabled',
};

const toNum = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1';
const trimOrNull = (v) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

/** Valeur comparable (Decimal / Date / JSON) pour le diff d'audit. */
const plain = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.parse(JSON.stringify(v));
  return v;
};

class NodeService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 20);
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const item = await repo.findByIdWithDeleted(id);
    if (!item) throw { statusCode: 404, message: 'Node introuvable' };
    return item;
  }

  /** Dépendances bloquantes pour la suppression (US-033). */
  async getDependencies(id) {
    const item = await repo.findByIdWithDeleted(id);
    if (!item) throw { statusCode: 404, message: 'Node introuvable' };
    const [active_orders, active_stock] = await Promise.all([
      repo.countActiveOrders(id),
      repo.countActiveStock(id),
    ]);
    return {
      active_orders,
      active_stock,
      can_delete: !item.is_deleted && active_orders === 0 && active_stock === 0,
    };
  }

  async _validateRefs(data) {
    const [type, region, city] = await Promise.all([
      data.node_type_id ? prisma.nodeType.findUnique({ where: { id: data.node_type_id } }) : null,
      data.region_id ? prisma.region.findFirst({ where: { id: data.region_id, is_deleted: false } }) : null,
      data.city_id ? prisma.city.findFirst({ where: { id: data.city_id, is_deleted: false } }) : null,
    ]);
    if (data.node_type_id && !type) throw { statusCode: 400, message: 'Type de node invalide' };
    if (data.region_id && !region) throw { statusCode: 400, message: 'Région invalide ou supprimée' };
    if (data.city_id && !city) throw { statusCode: 400, message: 'Ville invalide ou supprimée' };
    if (region && city && city.region_id !== region.id) {
      throw { statusCode: 400, message: 'La ville ne dépend pas de la région sélectionnée' };
    }
    return { type, region, city };
  }

  /** Construit un payload Prisma partiel : seules les clés envoyées sont converties. */
  _mapPayload(data = {}) {
    const raw = { ...data };
    for (const [alias, target] of Object.entries(ALIASES)) {
      if (raw[alias] !== undefined && raw[target] === undefined) raw[target] = raw[alias];
    }

    const payload = {};
    for (const k of FIELDS) if (raw[k] !== undefined) payload[k] = raw[k];

    ['code', 'name_fr', 'name_ar'].forEach((k) => {
      if (payload[k] !== undefined) payload[k] = String(payload[k] ?? '').trim();
    });
    if (payload.code !== undefined) payload.code = payload.code.toUpperCase();
    ['address_line1', 'quartier', 'postal_code', 'phone'].forEach((k) => {
      if (payload[k] !== undefined) payload[k] = trimOrNull(payload[k]);
    });
    if (payload.timezone !== undefined) payload.timezone = trimOrNull(payload.timezone) || 'Africa/Casablanca';
    ['node_type_id', 'region_id', 'city_id'].forEach((k) => {
      if (payload[k] === '' || payload[k] === null) delete payload[k];
    });

    ['lat', 'lng', 'delivery_radius_km'].forEach((k) => {
      if (payload[k] !== undefined) {
        payload[k] = toNum(payload[k]);
        if (payload[k] !== null && !Number.isFinite(payload[k])) {
          throw { statusCode: 400, message: `Valeur numérique invalide pour ${k}` };
        }
      }
    });
    if (payload.max_daily_orders !== undefined) {
      payload.max_daily_orders = payload.max_daily_orders === null || payload.max_daily_orders === ''
        ? null
        : Number(payload.max_daily_orders);
      if (payload.max_daily_orders !== null && (!Number.isInteger(payload.max_daily_orders) || payload.max_daily_orders < 0)) {
        throw { statusCode: 400, message: 'La capacité max / jour doit être un entier positif ou nul' };
      }
    }

    // Paramètres tarifaires par node (US-032 / US-093) : MAD, >= 0 (0 = gratuit / pas de minimum).
    const money = {
      delivery_fee: ['Les frais de livraison doivent être un montant valide', 'Les frais de livraison doivent être supérieurs ou égaux à 0 MAD'],
      min_order_amount: ['Le montant minimum de commande doit être un montant valide', 'Le montant minimum de commande doit être supérieur ou égal à 0 MAD'],
    };
    for (const [k, [invalidMsg, negativeMsg]] of Object.entries(money)) {
      if (payload[k] === undefined) continue;
      const n = payload[k] === null || payload[k] === '' ? 0 : Number(payload[k]);
      if (!Number.isFinite(n)) throw { statusCode: 400, message: invalidMsg };
      if (n < 0) throw { statusCode: 400, message: negativeMsg };
      payload[k] = Math.round(n * 100) / 100;
    }

    if (payload.is_active !== undefined) payload.is_active = toBool(payload.is_active);
    if (payload.slot_selection_enabled !== undefined) payload.slot_selection_enabled = toBool(payload.slot_selection_enabled);

    if (payload.lat !== undefined && payload.lat !== null && (payload.lat < -90 || payload.lat > 90)) {
      throw { statusCode: 400, message: 'Latitude invalide (doit être entre -90 et 90)' };
    }
    if (payload.lng !== undefined && payload.lng !== null && (payload.lng < -180 || payload.lng > 180)) {
      throw { statusCode: 400, message: 'Longitude invalide (doit être entre -180 et 180)' };
    }
    if (payload.delivery_radius_km !== undefined && payload.delivery_radius_km !== null && payload.delivery_radius_km < 0) {
      throw { statusCode: 400, message: 'Le rayon de livraison doit être positif ou nul' };
    }

    if (payload.opening_hours_json && typeof payload.opening_hours_json === 'string') {
      try {
        payload.opening_hours_json = JSON.parse(payload.opening_hours_json);
      } catch {
        throw { statusCode: 400, message: 'Horaires invalides (JSON attendu)' };
      }
    }
    return payload;
  }

  async create(data, req = null) {
    const payload = this._mapPayload(data);
    if (!payload.code) throw { statusCode: 400, message: 'Code requis' };
    if (!payload.name_fr) throw { statusCode: 400, message: 'Nom FR requis' };
    if (!payload.name_ar) throw { statusCode: 400, message: 'Nom AR requis' };
    if (!payload.node_type_id) throw { statusCode: 400, message: 'Type de node requis' };
    if (!payload.city_id) throw { statusCode: 400, message: 'Ville requise (la ville doit exister au préalable)' };

    const exists = await repo.findByCode(payload.code);
    if (exists) throw { statusCode: 409, message: 'Ce code node existe déjà' };

    const { city } = await this._validateRefs(payload);
    if (city && !city.is_active) throw { statusCode: 400, message: 'La ville sélectionnée est inactive' };
    // La région découle de la ville (city.region_id) si elle n'est pas fournie.
    if (!payload.region_id) payload.region_id = city.region_id;

    const created = await repo.create(payload);
    await audit(req, { action: 'CREATE', resource: 'nodes', resource_id: created.id, new_values: payload });
    return created;
  }

  async update(id, data, req = null) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Node introuvable' };
    const payload = this._mapPayload(data);
    if (payload.code !== undefined && !payload.code) throw { statusCode: 400, message: 'Code requis' };
    if (payload.name_fr !== undefined && !payload.name_fr) throw { statusCode: 400, message: 'Nom FR requis' };
    if (payload.name_ar !== undefined && !payload.name_ar) throw { statusCode: 400, message: 'Nom AR requis' };
    if (payload.code) {
      const exists = await repo.findByCode(payload.code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code node existe déjà' };
    }

    // Changement de ville sans région explicite : la région suit la ville.
    if (payload.city_id && !payload.region_id) {
      const city = await prisma.city.findFirst({ where: { id: payload.city_id, is_deleted: false } });
      if (city) payload.region_id = city.region_id;
    }
    await this._validateRefs({
      node_type_id: payload.node_type_id || item.node_type_id,
      region_id: payload.region_id || item.region_id,
      city_id: payload.city_id || item.city_id,
    });

    // Diff avant / après (uniquement les champs réellement modifiés).
    const old_values = {};
    const new_values = {};
    for (const [k, v] of Object.entries(payload)) {
      const before = plain(item[k]);
      const after = plain(v);
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        old_values[k] = before;
        new_values[k] = after;
      }
    }

    const updated = await repo.update(id, payload);

    const changed = Object.keys(new_values);
    if (changed.length) {
      let action = 'UPDATE';
      if (changed.length === 1 && changed[0] === 'is_active') action = payload.is_active ? 'ACTIVATE' : 'DEACTIVATE';
      await audit(req, { action, resource: 'nodes', resource_id: id, old_values, new_values });
      // WF #21 / US-093 : toute modification du montant minimum est tracée explicitement.
      if (changed.includes('min_order_amount')) {
        await audit(req, {
          action: 'UPDATE_MIN_ORDER_AMOUNT',
          resource: 'nodes',
          resource_id: id,
          old_values: { min_order_amount: old_values.min_order_amount },
          new_values: { min_order_amount: new_values.min_order_amount },
        });
      }
    }
    return updated;
  }

  async delete(id, req = null) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Node introuvable' };

    // US-033 : suppression bloquée si commandes ou stock actifs.
    const [activeOrders, activeStock] = await Promise.all([
      repo.countActiveOrders(id),
      repo.countActiveStock(id),
    ]);
    if (activeOrders > 0 || activeStock > 0) {
      const parts = [];
      if (activeOrders > 0) parts.push(`${activeOrders} commande(s) active(s)`);
      if (activeStock > 0) parts.push(`${activeStock} SKU avec du stock`);
      throw {
        statusCode: 409,
        message: `Suppression impossible : ce node a ${parts.join(' et ')}. Désactivez-le à la place.`,
      };
    }

    await repo.softDelete(id);
    await audit(req, {
      action: 'DELETE',
      resource: 'nodes',
      resource_id: id,
      old_values: { code: item.code, name_fr: item.name_fr, is_active: item.is_active, is_deleted: false },
      new_values: { is_deleted: true, is_active: false },
    });
  }
}

module.exports = new NodeService();
