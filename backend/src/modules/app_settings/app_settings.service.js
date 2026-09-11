const prisma = require('../../config/database');
const { audit } = require('../../utils/audit');
const { P0_TABLE_GROUPS } = require('../p0/p0.registry');

/**
 * Admin / Configuration > App Configs & Méthodes de paiement — monté sur /admin/settings.
 *  - Paramètres applicatifs : clés GLOBALES de app_configs (node_id IS NULL) — US-007.
 *    Les paramètres PAR NODE (min_order_amount, delivery_fee) se gèrent dans Master Data > Nodes.
 *  - Méthodes de paiement : payment_methods (COD principal) — US-008 / US-009.
 *  - Lookups : référentiels enum, édités via l'éditeur générique /p0/tables/<table> — US-010.
 */

/* ───────────────────────── Catégories de configuration ───────────────────────── */

const CATEGORIES = [
  { key: 'paiement', label: 'Paiement', test: (k) => /^(payment|cod|wallet|card)/.test(k) },
  { key: 'commandes', label: 'Commandes & livraison', test: (k) => /(order|delivery|slot|checkout|cart|tour|picking)/.test(k) },
  { key: 'fidelite', label: 'Fidélité & marketing', test: (k) => /(point|loyal|referral|promo|coupon|game|flash)/.test(k) },
  { key: 'notifications', label: 'Notifications', test: (k) => /(notif|sms|push|email|mail|whatsapp|otp)/.test(k) },
  { key: 'systeme', label: 'Système', test: (k) => /(maintenance|^app_|version|support|timezone|currency|locale|language)/.test(k) },
];
const DEFAULT_CATEGORY = { key: 'general', label: 'Général' };

const categoryOf = (key) => {
  const k = String(key || '').toLowerCase();
  const c = CATEGORIES.find((x) => x.test(k)) || DEFAULT_CATEGORY;
  return { key: c.key, label: c.label };
};

// Clés historiquement globales mais désormais portées par la table nodes (US-007).
const NODE_LEVEL_KEYS = ['min_order_amount', 'delivery_fee'];

/* ───────────────────────────── Valeurs typées ───────────────────────────── */

/** Contrôle et normalise une valeur selon config_value_types.code. */
const normalizeValue = (raw, typeCode) => {
  const code = String(typeCode || 'string').toLowerCase();
  if (raw === undefined || raw === null) throw { statusCode: 400, message: 'Valeur requise' };
  const s = typeof raw === 'string' ? raw.trim() : (typeof raw === 'object' ? JSON.stringify(raw) : String(raw));

  switch (code) {
    case 'integer':
    case 'int': {
      if (!/^-?\d+$/.test(s)) throw { statusCode: 400, message: 'Valeur invalide : un nombre entier est attendu' };
      return String(parseInt(s, 10));
    }
    case 'number':
    case 'decimal':
    case 'float': {
      const n = Number(s.replace(',', '.'));
      if (s === '' || !Number.isFinite(n)) throw { statusCode: 400, message: 'Valeur invalide : un nombre est attendu' };
      return String(n);
    }
    case 'boolean':
    case 'bool': {
      const l = s.toLowerCase();
      if (['true', '1', 'oui', 'yes'].includes(l)) return 'true';
      if (['false', '0', 'non', 'no'].includes(l)) return 'false';
      throw { statusCode: 400, message: 'Valeur invalide : vrai ou faux attendu' };
    }
    case 'json': {
      try {
        return JSON.stringify(JSON.parse(s));
      } catch {
        throw { statusCode: 400, message: 'Valeur invalide : JSON mal formé' };
      }
    }
    default:
      if (s === '') throw { statusCode: 400, message: 'Valeur requise' };
      return s;
  }
};

const CONFIG_INCLUDE = {
  value_type: { select: { id: true, code: true, name_fr: true, name_ar: true } },
  editor: { select: { id: true, full_name: true, email: true } },
};

const decorate = (row) => ({
  ...row,
  category: categoryOf(row.config_key),
  node_level: NODE_LEVEL_KEYS.includes(row.config_key),
});

/* ───────────────────────────── Lookups ───────────────────────────── */

const delegateOf = (model) => model.charAt(0).toLowerCase() + model.slice(1);

// Référentiels disposant d'un écran métier dédié (plutôt que l'éditeur générique).
const DEDICATED_LOOKUPS = {
  id: 'lookups_referentiels',
  titleFr: 'Référentiels géographiques, nodes & entrepôt',
  tables: [
    { model: 'Region', sql: 'regions', labelFr: 'Régions', path: '/geo' },
    { model: 'City', sql: 'cities', labelFr: 'Villes', path: '/geo' },
    { model: 'NodeType', sql: 'node_types', labelFr: 'Types de node', path: '/node-types' },
    { model: 'Zone', sql: 'zones', labelFr: 'Zones entrepôt', path: '/warehouse/zones' },
    { model: 'Level', sql: 'levels', labelFr: 'Niveaux de rayonnage', path: '/warehouse/levels' },
    { model: 'Unit', sql: 'units', labelFr: 'Unités', path: '/catalog/refs' },
  ],
};

class AppSettingsService {
  /* ── Paramètres applicatifs ── */

  async listConfigs({ category, search } = {}) {
    const q = search ? String(search).trim() : '';
    const rows = await prisma.appConfig.findMany({
      where: {
        node_id: null,
        ...(q && {
          OR: [
            { config_key: { contains: q, mode: 'insensitive' } },
            { config_value: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }),
      },
      include: CONFIG_INCLUDE,
      orderBy: { config_key: 'asc' },
    });
    const data = rows.map(decorate).filter((r) => !category || r.category.key === category);
    return {
      data,
      categories: [...CATEGORIES, DEFAULT_CATEGORY].map(({ key, label }) => ({ key, label })),
    };
  }

  async listValueTypes() {
    return prisma.configValueType.findMany({ orderBy: { code: 'asc' } });
  }

  async createConfig(body = {}, req) {
    const key = String(body.config_key || '').trim().toLowerCase();
    if (!key) throw { statusCode: 400, message: 'Clé de configuration requise' };
    if (!/^[a-z0-9_.-]{2,100}$/.test(key)) {
      throw { statusCode: 400, message: 'Clé invalide : lettres minuscules, chiffres, « _ », « . » ou « - » (2 à 100 caractères)' };
    }
    if (NODE_LEVEL_KEYS.includes(key)) {
      throw { statusCode: 400, message: 'Ce paramètre est défini par node (Master Data > Nodes), pas dans les paramètres globaux' };
    }
    const valueType = body.value_type_id
      ? await prisma.configValueType.findUnique({ where: { id: String(body.value_type_id) } })
      : await prisma.configValueType.findFirst({ where: { code: String(body.value_type_code || 'string') } });
    if (!valueType) throw { statusCode: 400, message: 'Type de valeur invalide' };

    // Unicité (node_id NULL non couvert par l'index unique PG) : contrôle applicatif.
    const exists = await prisma.appConfig.findFirst({ where: { node_id: null, config_key: key } });
    if (exists) throw { statusCode: 409, message: 'Cette clé de configuration existe déjà' };

    const value = normalizeValue(body.config_value, valueType.code);
    const description = body.description ? String(body.description).trim() || null : null;
    const created = await prisma.appConfig.create({
      data: {
        node_id: null,
        config_key: key,
        config_value: value,
        value_type_id: valueType.id,
        description,
        updated_by: req.user.id,
      },
      include: CONFIG_INCLUDE,
    });
    await audit(req, {
      action: 'CREATE',
      resource: 'app_configs',
      resource_id: created.id,
      new_values: { config_key: key, config_value: value, value_type: valueType.code, description },
    });
    return decorate(created);
  }

  async updateConfig(id, body = {}, req) {
    const item = await prisma.appConfig.findUnique({ where: { id }, include: CONFIG_INCLUDE });
    if (!item) throw { statusCode: 404, message: 'Paramètre introuvable' };
    if (item.node_id) {
      throw { statusCode: 400, message: 'Paramètre spécifique à un node : il se gère dans Master Data > Nodes' };
    }

    const data = {};
    if (body.config_value !== undefined) data.config_value = normalizeValue(body.config_value, item.value_type?.code);
    if (body.description !== undefined) {
      const d = body.description === null ? '' : String(body.description).trim();
      data.description = d === '' ? null : d;
    }
    if (!Object.keys(data).length) throw { statusCode: 400, message: 'Aucune modification fournie' };

    const old_values = {};
    const new_values = {};
    Object.entries(data).forEach(([k, v]) => {
      if ((item[k] ?? null) !== (v ?? null)) {
        old_values[k] = item[k] ?? null;
        new_values[k] = v ?? null;
      }
    });
    if (!Object.keys(new_values).length) return decorate(item);

    const updated = await prisma.appConfig.update({
      where: { id },
      data: { ...data, updated_by: req.user.id },
      include: CONFIG_INCLUDE,
    });
    await audit(req, {
      action: 'CONFIG_CHANGE',
      resource: 'app_configs',
      resource_id: id,
      old_values: { config_key: item.config_key, ...old_values },
      new_values: { config_key: item.config_key, ...new_values },
    });
    return decorate(updated);
  }

  /* ── Méthodes de paiement ── */

  async listPaymentMethods() {
    const rows = await prisma.paymentMethod.findMany({
      include: { _count: { select: { payments: true } } },
      orderBy: { code: 'asc' },
    });
    return rows.map(({ _count, ...r }) => ({ ...r, payments_count: _count?.payments ?? 0 }));
  }

  _pickMethod(body = {}, mode) {
    const out = {};
    ['name_fr', 'name_ar', 'description'].forEach((k) => {
      if (body[k] !== undefined) out[k] = body[k] === null ? null : String(body[k]).trim();
    });
    if (out.description === '') out.description = null;
    if (mode === 'create') {
      out.code = String(body.code || '').trim().toLowerCase().replace(/\s+/g, '_');
      out.is_active = body.is_active === undefined ? true : (body.is_active === true || body.is_active === 'true');
    }
    if (out.name_fr !== undefined && !out.name_fr) throw { statusCode: 400, message: 'Libellé FR requis' };
    if (out.name_ar !== undefined && !out.name_ar) throw { statusCode: 400, message: 'Libellé AR requis' };
    if (out.description && out.description.length > 255) throw { statusCode: 400, message: 'Description trop longue (255 caractères max.)' };
    return out;
  }

  async createPaymentMethod(body, req) {
    const data = this._pickMethod(body, 'create');
    if (!data.code) throw { statusCode: 400, message: 'Code requis' };
    if (!/^[a-z0-9_]{2,50}$/.test(data.code)) throw { statusCode: 400, message: 'Code invalide (lettres minuscules, chiffres, « _ »)' };
    if (!data.name_fr) throw { statusCode: 400, message: 'Libellé FR requis' };
    if (!data.name_ar) throw { statusCode: 400, message: 'Libellé AR requis' };
    const exists = await prisma.paymentMethod.findUnique({ where: { code: data.code } });
    if (exists) throw { statusCode: 409, message: `Le code « ${data.code} » existe déjà` };
    const created = await prisma.paymentMethod.create({ data });
    await audit(req, { action: 'CREATE', resource: 'payment_methods', resource_id: created.id, new_values: data });
    return { ...created, payments_count: 0 };
  }

  async updatePaymentMethod(id, body, req) {
    const item = await prisma.paymentMethod.findUnique({ where: { id } });
    if (!item) throw { statusCode: 404, message: 'Méthode de paiement introuvable' };
    const data = this._pickMethod(body, 'update');
    if (!Object.keys(data).length) throw { statusCode: 400, message: 'Aucune modification fournie' };
    const updated = await prisma.paymentMethod.update({ where: { id }, data });
    const old_values = {};
    Object.keys(data).forEach((k) => { old_values[k] = item[k] ?? null; });
    await audit(req, { action: 'UPDATE', resource: 'payment_methods', resource_id: id, old_values, new_values: data });
    return updated;
  }

  async togglePaymentMethod(id, req) {
    const item = await prisma.paymentMethod.findUnique({ where: { id } });
    if (!item) throw { statusCode: 404, message: 'Méthode de paiement introuvable' };
    if (item.is_active) {
      const activeCount = await prisma.paymentMethod.count({ where: { is_active: true } });
      if (activeCount <= 1) {
        throw { statusCode: 409, message: 'Impossible de désactiver la dernière méthode de paiement active' };
      }
    }
    const updated = await prisma.paymentMethod.update({ where: { id }, data: { is_active: !item.is_active } });
    await audit(req, {
      action: item.is_active ? 'DEACTIVATE' : 'ACTIVATE',
      resource: 'payment_methods',
      resource_id: id,
      old_values: { code: item.code, is_active: item.is_active },
      new_values: { code: item.code, is_active: !item.is_active },
    });
    return updated;
  }

  /* ── Lookups ── */

  async listLookups() {
    const groups = [
      DEDICATED_LOOKUPS,
      ...P0_TABLE_GROUPS.filter((g) => String(g.id).startsWith('lookups_')),
    ];
    return Promise.all(groups.map(async (g) => ({
      id: g.id,
      title: String(g.titleFr || '').replace(/\s*--\s*/g, ' — '),
      tables: await Promise.all(g.tables.map(async (t) => {
        let count = null;
        try {
          const delegate = prisma[delegateOf(t.model)];
          if (delegate?.count) count = await delegate.count();
        } catch {
          count = null;
        }
        return {
          model: t.model,
          table: t.sql,
          label: t.labelFr,
          count,
          path: t.path || `/p0/tables/${t.sql}`,
          dedicated: Boolean(t.path),
        };
      })),
    })));
  }
}

module.exports = new AppSettingsService();
module.exports.normalizeValue = normalizeValue;
module.exports.categoryOf = categoryOf;
