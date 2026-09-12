const prisma = require('../../config/database');
const { audit } = require('../../utils/audit');
const platformConfig = require('../../utils/platform-config');
const { P0_TABLE_GROUPS } = require('../p0/p0.registry');

/**
 * Admin / Configuration > App Configs & Méthodes de paiement — monté sur /admin/settings.
 *  - Paramètres applicatifs : clés GLOBALES de app_configs, liste FERMÉE (WF #41,
 *    US-007 / US-118 / US-119). Édition de la valeur uniquement : ni création,
 *    ni suppression de clé. Les paramètres PAR NODE (min_order_amount,
 *    delivery_fee) se gèrent dans Master Data > Nodes.
 *  - Méthodes de paiement PAR NODE : node_payment_methods (WF #42) — l'activation
 *    réelle se fait node par node ; payment_methods reste le catalogue.
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

/* ── Liste fermée des clés globales du classeur (WF #41) ──────────────────── */

const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const isPhone = (v) => /^\+?[0-9][0-9\s.-]{7,19}$/.test(String(v).trim());
const isHttpUrl = (v) => /^https?:\/\/[^\s]+\.[^\s]{2,}$/i.test(String(v).trim());

/**
 * Clés spécifiées par le classeur. `check` refuse une valeur invalide ;
 * `impact` déclenche un avertissement avant confirmation côté écran.
 */
const SPEC_KEYS = {
  week_start_day: {
    label: 'Premier jour de la semaine',
    check: (v) => (WEEK_DAYS.includes(String(v).trim().toLowerCase())
      ? null : `Valeur attendue parmi : ${WEEK_DAYS.join(', ')}`),
    options: WEEK_DAYS,
    impact: 'Tous les quotas et agrégats hebdomadaires (jeux, codes promo, rapports) basculeront sur ce jour.',
  },
  default_timezone: {
    label: 'Fuseau horaire',
    check: (v) => (/^[A-Za-z]+\/[A-Za-z_+-]+$/.test(String(v).trim()) ? null : 'Fuseau IANA attendu, ex. Africa/Casablanca'),
  },
  default_currency: {
    label: 'Devise',
    check: (v) => (/^[A-Z]{3}$/.test(String(v).trim()) ? null : 'Code ISO à 3 lettres attendu, ex. MAD'),
  },
  support_phone: { label: 'Téléphone du support', check: (v) => (isPhone(v) ? null : 'Numéro de téléphone invalide') },
  support_whatsapp: { label: 'WhatsApp du support', check: (v) => (isPhone(v) ? null : 'Numéro WhatsApp invalide') },
  cgu_url: { label: "Conditions générales d'utilisation", check: (v) => (isHttpUrl(v) ? null : 'Lien http(s) invalide') },
  privacy_url: { label: 'Politique de confidentialité', check: (v) => (isHttpUrl(v) ? null : 'Lien http(s) invalide') },
};
const SPEC_ORDER = Object.keys(SPEC_KEYS);

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

const decorate = (row) => {
  const spec = SPEC_KEYS[row.config_key] || null;
  return {
    ...row,
    category: categoryOf(row.config_key),
    node_level: NODE_LEVEL_KEYS.includes(row.config_key),
    // Clé de la liste fermée du classeur : libellé lisible, options, avertissement.
    spec: Boolean(spec),
    spec_label: spec?.label ?? null,
    options: spec?.options ?? null,
    impact: spec?.impact ?? null,
  };
};

/** Refuse une valeur vide ou hors format pour les clés spécifiées (US-118 / US-119). */
const checkSpecValue = (key, value) => {
  const spec = SPEC_KEYS[key];
  if (!spec) return;
  const v = value === null || value === undefined ? '' : String(value).trim();
  if (!v) throw { statusCode: 400, message: `${spec.label} : une valeur est requise` };
  const err = spec.check ? spec.check(v) : null;
  if (err) throw { statusCode: 400, message: `${spec.label} — ${err}` };
};

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
    const data = rows
      .map(decorate)
      .filter((r) => !category || r.category.key === category)
      // Les clés du classeur d'abord, dans l'ordre de la spécification.
      .sort((a, b) => {
        const ia = SPEC_ORDER.indexOf(a.config_key);
        const ib = SPEC_ORDER.indexOf(b.config_key);
        if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        return a.config_key.localeCompare(b.config_key);
      });
    return {
      data,
      spec_keys: SPEC_ORDER,
      categories: [...CATEGORIES, DEFAULT_CATEGORY].map(({ key, label }) => ({ key, label })),
    };
  }

  async listValueTypes() {
    return prisma.configValueType.findMany({ orderBy: { code: 'asc' } });
  }

  /** Liste fermée : la création d'une clé passe par une migration, jamais par l'écran. */
  async createConfig() {
    throw {
      statusCode: 403,
      message: "Liste de clés fermée : seule la valeur d'un paramètre existant peut être modifiée.",
    };
  }

  async updateConfig(id, body = {}, req) {
    const item = await prisma.appConfig.findUnique({ where: { id }, include: CONFIG_INCLUDE });
    if (!item) throw { statusCode: 404, message: 'Paramètre introuvable' };

    const data = {};
    if (body.config_value !== undefined) {
      checkSpecValue(item.config_key, body.config_value);
      data.config_value = normalizeValue(body.config_value, item.value_type?.code);
    }
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
    // Effet immédiat des clés globales (week_start_day, fuseau, devise…).
    platformConfig.invalidate();
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

  /* ── Méthodes de paiement par node (WF #42) ── */

  async _node(node_id) {
    const node = await prisma.node.findFirst({
      where: { id: String(node_id), is_deleted: false },
      select: { id: true, code: true, name_fr: true, name_ar: true },
    });
    if (!node) throw { statusCode: 404, message: 'Nœud introuvable' };
    return node;
  }

  /** Liste des méthodes avec leur état d'activation sur ce node. */
  async listNodePaymentMethods(node_id) {
    const node = await this._node(node_id);
    const [methods, links] = await Promise.all([
      prisma.paymentMethod.findMany({ orderBy: { code: 'asc' } }),
      prisma.nodePaymentMethod.findMany({
        where: { node_id: node.id },
        include: { editor: { select: { id: true, full_name: true } } },
      }),
    ]);
    const byMethod = Object.fromEntries(links.map((l) => [l.payment_method_id, l]));
    return {
      node,
      data: methods.map((m) => {
        const link = byMethod[m.id] || null;
        return {
          payment_method_id: m.id,
          code: m.code,
          name_fr: m.name_fr,
          name_ar: m.name_ar,
          description: m.description,
          catalog_active: m.is_active,
          is_active: Boolean(link?.is_active),
          updated_at: link?.updated_at ?? null,
          updated_by: link?.editor?.full_name ?? null,
        };
      }),
    };
  }

  /** Active ou désactive une méthode sur un node ; au moins une doit rester active. */
  async setNodePaymentMethod(node_id, payment_method_id, is_active, req) {
    const node = await this._node(node_id);
    const method = await prisma.paymentMethod.findUnique({ where: { id: String(payment_method_id) } });
    if (!method) throw { statusCode: 404, message: 'Méthode de paiement introuvable' };
    const active = is_active === true || is_active === 'true';
    if (active && !method.is_active) {
      throw { statusCode: 409, message: `La méthode « ${method.name_fr} » est désactivée dans le catalogue` };
    }
    if (!active) {
      const others = await prisma.nodePaymentMethod.count({
        where: { node_id: node.id, is_active: true, payment_method_id: { not: method.id } },
      });
      if (others === 0) {
        throw { statusCode: 409, message: 'Impossible de désactiver la dernière méthode de paiement de ce nœud' };
      }
    }
    const existing = await prisma.nodePaymentMethod.findUnique({
      where: { node_id_payment_method_id: { node_id: node.id, payment_method_id: method.id } },
    });
    const row = await prisma.nodePaymentMethod.upsert({
      where: { node_id_payment_method_id: { node_id: node.id, payment_method_id: method.id } },
      update: { is_active: active, updated_by: req?.user?.id ?? null },
      create: {
        node_id: node.id,
        payment_method_id: method.id,
        is_active: active,
        created_by: req?.user?.id ?? null,
        updated_by: req?.user?.id ?? null,
      },
    });
    await audit(req, {
      action: active ? 'ACTIVATE' : 'DEACTIVATE',
      resource: 'node_payment_methods',
      resource_id: row.id,
      old_values: { node: node.code, method: method.code, is_active: Boolean(existing?.is_active) },
      new_values: { node: node.code, method: method.code, is_active: active },
    });
    return row;
  }

  /** Synthèse méthodes × nodes (lecture seule). */
  async paymentMethodMatrix() {
    const [nodes, methods, links] = await Promise.all([
      prisma.node.findMany({
        where: { is_deleted: false },
        select: { id: true, code: true, name_fr: true, name_ar: true },
        orderBy: { code: 'asc' },
      }),
      prisma.paymentMethod.findMany({ orderBy: { code: 'asc' } }),
      prisma.nodePaymentMethod.findMany({ select: { node_id: true, payment_method_id: true, is_active: true } }),
    ]);
    const key = (n, m) => `${n}|${m}`;
    const active = new Set(links.filter((l) => l.is_active).map((l) => key(l.node_id, l.payment_method_id)));
    return {
      methods: methods.map((m) => ({ id: m.id, code: m.code, name_fr: m.name_fr, name_ar: m.name_ar, catalog_active: m.is_active })),
      nodes: nodes.map((n) => ({
        ...n,
        methods: Object.fromEntries(methods.map((m) => [m.id, active.has(key(n.id, m.id))])),
        active_count: methods.filter((m) => active.has(key(n.id, m.id))).length,
      })),
    };
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
