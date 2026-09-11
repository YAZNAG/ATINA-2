const prisma = require('../../config/database');
const { audit } = require('../../utils/audit');
const { PROMO_INCLUDE, formatCoupon } = require('./coupons.shared');
const { notifyCouponCreated } = require('../../utils/notify');

/*
 * Codes promo (table promotions = « promocodes » du classeur).
 * Règles : WF #17 (création), WF #34 (modification / suppression), US-076, US-077, US-115.
 *  - code unique, valeur > 0 (sauf FREE_SHIPPING), % <= 100, valid_to > valid_from, is_combined FALSE par défaut ;
 *  - uses_count = 0  → tous les champs modifiables ;
 *  - uses_count > 0  → seuls valid_to, uses_max (>= uses_count) et is_active ;
 *  - origine Gamification (play_id) / Parrainage (referral_id) → lecture seule sauf activer/désactiver/supprimer ;
 *  - suppression = soft-delete, refusée si uses_count > 0 ou si une commande non terminale référence le code ;
 *  - toute action (et toute tentative refusée) est tracée dans audit_logs.
 */

const RESOURCE = 'promotions';
const TERMINAL_CODES = ['delivered', 'cancelled', 'returned'];

const ADMIN_INCLUDE = {
  ...PROMO_INCLUDE,
  node: { select: { id: true, code: true, name_fr: true } },
};

const ORIGIN_LABELS = { manual: 'Manuel', gamification: 'Gamification', referral: 'Parrainage' };
const STATUS_LABELS = {
  active: 'Actif', inactive: 'Inactif', scheduled: 'Programmé', expired: 'Expiré',
  exhausted: 'Épuisé', deleted: 'Supprimé',
};
const FIELD_LABELS = {
  code: 'Code', promo_type_id: 'Type', value: 'Valeur', max_discount: 'Remise max',
  min_order_amount: 'Montant minimum', is_combined: 'Cumul avec d\'autres offres',
  customer_id: 'Client affecté', node_id: 'Node', uses_max: 'Nb max d\'utilisations',
  uses_per_user_max: 'Max par client', valid_from: 'Date de début', valid_to: 'Date de fin',
  is_active: 'Activation',
};
const ALL_FIELDS = Object.keys(FIELD_LABELS);
const USED_EDITABLE = ['valid_to', 'uses_max', 'is_active'];

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const isBlank = (v) => v === undefined || v === null || v === '' || v === 'null';

function parseBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return ['true', '1', 'on', 'yes', 'oui'].includes(v.trim().toLowerCase());
  return !!v;
}

function parseDate(v, label) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw { statusCode: 400, message: `${label} invalide` };
  return d;
}

function originOf(p) {
  if (p.play_id || p.is_gamification) return 'gamification';
  if (p.referral_id) return 'referral';
  return 'manual';
}

function statusOf(p, now = new Date()) {
  if (p.is_deleted) return 'deleted';
  if (!p.is_active) return 'inactive';
  if (new Date(p.valid_to) < now) return 'expired';
  if (new Date(p.valid_from) > now) return 'scheduled';
  if (p.uses_max != null && p.uses_count >= p.uses_max) return 'exhausted';
  return 'active';
}

function editableFieldsOf(p) {
  if (p.is_deleted) return [];
  if (originOf(p) !== 'manual') return ['is_active'];
  if (p.uses_count > 0) return [...USED_EDITABLE];
  return [...ALL_FIELDS];
}

function formatAdmin(p) {
  const base = formatCoupon(p);
  const origin = originOf(p);
  const status = statusOf(p);
  return {
    ...base,
    type_id:         p.promo_type_id,
    is_combined:     !!p.is_combined,
    is_gamification: !!p.is_gamification,
    play_id:         p.play_id,
    referral_id:     p.referral_id,
    origin,
    origin_label:    ORIGIN_LABELS[origin],
    node_code:       p.node?.code ?? null,
    node_name:       p.node?.name_fr ?? null,
    node_scope:      p.node_id ? 'node' : 'global',
    customer_phone:  p.customer?.phone_number ?? null,
    uses_remaining:  p.uses_max != null ? Math.max(0, p.uses_max - p.uses_count) : null,
    status,
    status_label:    STATUS_LABELS[status],
    is_deleted:      p.is_deleted,
    deleted_at:      p.deleted_at,
    created_at:      p.created_at,
    updated_at:      p.updated_at,
    editable_fields: editableFieldsOf(p),
    read_only:       p.is_deleted || origin !== 'manual',
  };
}

/** Instantané pour audit_logs. */
function snapshot(p) {
  if (!p) return null;
  return {
    code: p.code, promo_type_id: p.promo_type_id, value: Number(p.value),
    max_discount: p.max_discount != null ? Number(p.max_discount) : null,
    min_order_amount: Number(p.min_order_amount), is_combined: p.is_combined,
    customer_id: p.customer_id, node_id: p.node_id, uses_max: p.uses_max,
    uses_count: p.uses_count, uses_per_user_max: p.uses_per_user_max,
    valid_from: p.valid_from, valid_to: p.valid_to, is_active: p.is_active,
    is_deleted: p.is_deleted, play_id: p.play_id, referral_id: p.referral_id,
  };
}

async function resolvePromoType({ promo_type_id, type_code, type }) {
  if (!isBlank(promo_type_id)) {
    const pt = await prisma.promoType.findUnique({ where: { id: String(promo_type_id) } });
    if (!pt) throw { statusCode: 400, message: 'Type de remise inconnu' };
    return pt;
  }
  const code = !isBlank(type_code) ? type_code : type;
  if (!isBlank(code)) {
    const pt = await prisma.promoType.findUnique({ where: { code: String(code).toUpperCase() } });
    if (!pt) throw { statusCode: 400, message: `Type de remise inconnu : ${code}` };
    return pt;
  }
  return null;
}

/**
 * Normalise les champs métier présents dans le body (seulement ceux fournis).
 * Retourne { fields, promoType } ; promoType renseigné si le type est fourni.
 */
async function parseFields(body = {}) {
  const f = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  if (has('code')) f.code = String(body.code ?? '').trim().toUpperCase();
  let promoType = null;
  if (has('promo_type_id') || has('type_code') || has('type')) {
    promoType = await resolvePromoType(body);
    if (promoType) f.promo_type_id = promoType.id;
  }
  if (has('value')) {
    f.value = isBlank(body.value) ? 0 : Number(body.value);
    if (!Number.isFinite(f.value)) throw { statusCode: 400, message: 'Valeur invalide' };
  }
  if (has('max_discount')) {
    f.max_discount = isBlank(body.max_discount) ? null : Number(body.max_discount);
    if (f.max_discount != null && (!Number.isFinite(f.max_discount) || f.max_discount < 0)) {
      throw { statusCode: 400, message: 'Remise maximale invalide' };
    }
  }
  if (has('min_order_amount')) {
    f.min_order_amount = isBlank(body.min_order_amount) ? 0 : Number(body.min_order_amount);
    if (!Number.isFinite(f.min_order_amount) || f.min_order_amount < 0) {
      throw { statusCode: 400, message: 'Le montant minimum de commande doit être supérieur ou égal à 0' };
    }
  }
  if (has('is_combined')) f.is_combined = parseBool(body.is_combined);
  if (has('customer_id')) f.customer_id = isBlank(body.customer_id) ? null : String(body.customer_id);
  if (has('node_id')) f.node_id = isBlank(body.node_id) || body.node_id === 'global' ? null : String(body.node_id);
  if (has('uses_max')) {
    f.uses_max = isBlank(body.uses_max) ? null : Number(body.uses_max);
    if (f.uses_max != null && (!Number.isInteger(f.uses_max) || f.uses_max < 1)) {
      throw { statusCode: 400, message: 'Le nombre maximal d\'utilisations doit être un entier ≥ 1 (vide = illimité)' };
    }
  }
  if (has('uses_per_user_max')) {
    f.uses_per_user_max = isBlank(body.uses_per_user_max) ? 1 : Number(body.uses_per_user_max);
    if (!Number.isInteger(f.uses_per_user_max) || f.uses_per_user_max < 1) {
      throw { statusCode: 400, message: 'Le nombre d\'utilisations par client doit être un entier ≥ 1' };
    }
  }
  if (has('valid_from')) {
    if (isBlank(body.valid_from)) throw { statusCode: 400, message: 'Date de début requise' };
    f.valid_from = parseDate(body.valid_from, 'Date de début');
  }
  if (has('valid_to')) {
    if (isBlank(body.valid_to)) throw { statusCode: 400, message: 'Date de fin requise' };
    f.valid_to = parseDate(body.valid_to, 'Date de fin');
  }
  if (has('is_active')) f.is_active = parseBool(body.is_active);
  return { fields: f, promoType };
}

/** Contrôles complets (création, ou modification d'un code jamais utilisé). */
async function validateFull(data, typeCode, currentId = null) {
  if (!data.code) throw { statusCode: 400, message: 'Le code est obligatoire' };
  if (!/^[A-Z0-9_-]{3,50}$/.test(data.code)) {
    throw { statusCode: 400, message: 'Code invalide : 3 à 50 caractères, lettres, chiffres, « - » ou « _ » uniquement' };
  }
  if (!data.promo_type_id || !typeCode) throw { statusCode: 400, message: 'Le type de remise est obligatoire' };

  if (typeCode === 'FREE_SHIPPING') {
    data.value = 0;
  } else {
    if (!(Number(data.value) > 0)) throw { statusCode: 400, message: 'La valeur doit être strictement supérieure à 0' };
    if (typeCode === 'PERCENTAGE' && Number(data.value) > 100) {
      throw { statusCode: 400, message: 'Un pourcentage ne peut pas dépasser 100' };
    }
  }
  if (!data.valid_from || !data.valid_to) throw { statusCode: 400, message: 'Les dates de validité (début et fin) sont obligatoires' };
  if (new Date(data.valid_to) <= new Date(data.valid_from)) {
    throw { statusCode: 400, message: 'La date de fin doit être postérieure à la date de début' };
  }

  const dup = await prisma.promotion.findFirst({
    where: { code: { equals: data.code, mode: 'insensitive' }, ...(currentId && { id: { not: currentId } }) },
    select: { id: true, is_deleted: true },
  });
  if (dup) {
    throw {
      statusCode: 409,
      message: dup.is_deleted
        ? 'Ce code existe déjà (code supprimé conservé dans l\'historique) : choisissez un autre code'
        : 'Ce code existe déjà : le code doit être unique',
    };
  }

  if (data.node_id) {
    const node = await prisma.node.findFirst({ where: { id: data.node_id, is_deleted: false }, select: { id: true } });
    if (!node) throw { statusCode: 400, message: 'Node introuvable' };
  }
  if (data.customer_id) {
    const c = await prisma.customer.findFirst({ where: { id: data.customer_id, is_deleted: false }, select: { id: true } });
    if (!c) throw { statusCode: 400, message: 'Client affecté introuvable' };
  }
}

function sameValue(a, b) {
  if (a instanceof Date || b instanceof Date) {
    if (a == null || b == null) return a == b; // eslint-disable-line eqeqeq
    return new Date(a).getTime() === new Date(b).getTime();
  }
  if (a == null || b == null) return (a ?? null) === (b ?? null);
  if (typeof a === 'boolean' || typeof b === 'boolean') return !!a === !!b;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return String(a) === String(b);
}

function changedKeys(fields, existing) {
  return Object.keys(fields).filter((k) => !sameValue(fields[k], existing[k]));
}

// ————————————————————————————————————————— Lecture

function buildListWhere(query = {}) {
  const now = new Date();
  const and = [];

  if (query.status === 'deleted') and.push({ is_deleted: true });
  else {
    and.push({ is_deleted: false });
    switch (query.status) {
      case 'inactive':  and.push({ is_active: false }); break;
      case 'expired':   and.push({ is_active: true, valid_to: { lt: now } }); break;
      case 'scheduled': and.push({ is_active: true, valid_from: { gt: now }, valid_to: { gte: now } }); break;
      case 'exhausted':
        and.push({ is_active: true, valid_to: { gte: now }, uses_max: { not: null }, uses_count: { gte: prisma.promotion.fields.uses_max } });
        break;
      case 'active':
        and.push({ is_active: true, valid_from: { lte: now }, valid_to: { gte: now } });
        and.push({ OR: [{ uses_max: null }, { uses_count: { lt: prisma.promotion.fields.uses_max } }] });
        break;
      default: break;
    }
  }

  if (query.is_active !== undefined && query.is_active !== '') and.push({ is_active: parseBool(query.is_active) });
  if (query.node_id === 'global') and.push({ node_id: null });
  else if (query.node_id) and.push({ node_id: String(query.node_id) });

  const type = query.type ?? query.type_code;
  if (type) and.push({ promo_type: { code: String(type).toUpperCase() } });

  if (query.origin === 'manual') and.push({ play_id: null, referral_id: null, is_gamification: false });
  if (query.origin === 'gamification') and.push({ OR: [{ play_id: { not: null } }, { is_gamification: true }] });
  if (query.origin === 'referral') and.push({ referral_id: { not: null } });

  if (query.scope === 'public')   and.push({ customer_id: null });
  if (query.scope === 'personal') and.push({ customer_id: { not: null } });
  if (query.customer_id) and.push({ customer_id: String(query.customer_id) });

  const search = query.search ?? query.code;
  if (search) {
    and.push({
      OR: [
        { code: { contains: String(search), mode: 'insensitive' } },
        { customer: { name: { contains: String(search), mode: 'insensitive' } } },
        { customer: { phone_number: { contains: String(search) } } },
      ],
    });
  }
  return { AND: and };
}

async function getAll(query = {}) {
  const where = buildListWhere(query);
  const page  = Math.max(1, parseInt(query.page  ?? '1', 10) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(query.limit ?? '20', 10) || 20));
  const skip  = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.promotion.findMany({ where, include: ADMIN_INCLUDE, orderBy: { created_at: 'desc' }, skip, take: limit }),
    prisma.promotion.count({ where }),
  ]);
  const pagination = { total, page, limit, pages: Math.ceil(total / limit) };
  return { data: items.map(formatAdmin), pagination, meta: pagination };
}

async function getById(id) {
  const promo = await prisma.promotion.findFirst({ where: { id }, include: ADMIN_INCLUDE });
  if (!promo) throw { statusCode: 404, message: 'Code promo introuvable' };
  const activeOrders = await countActiveOrders(id);
  return { ...formatAdmin(promo), active_orders_count: activeOrders };
}

async function getLookups() {
  const [nodes, promoTypes, orderStatuses] = await Promise.all([
    prisma.node.findMany({ where: { is_deleted: false }, select: { id: true, code: true, name_fr: true, is_active: true }, orderBy: { name_fr: 'asc' } }),
    prisma.promoType.findMany({ select: { id: true, code: true, name_fr: true, name_ar: true }, orderBy: { code: 'asc' } }),
    prisma.orderStatus.findMany({ select: { id: true, code: true, name_fr: true, is_terminal: true, color: true }, orderBy: { sort_order: 'asc' } }),
  ]);
  return { nodes, promo_types: promoTypes, order_statuses: orderStatuses };
}

async function searchCustomers(query = {}) {
  const search = String(query.search ?? '').trim();
  const where = { is_deleted: false };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone_number: { contains: search } },
    ];
  }
  const rows = await prisma.customer.findMany({
    where,
    select: { id: true, name: true, phone_country: true, phone_number: true, is_active: true },
    orderBy: { name: 'asc' },
    take: 20,
  });
  return rows;
}

// ————————————————————————————————————————— Commandes liées

function activeOrdersWhere(promotionId) {
  return {
    promotion_id: promotionId,
    is_deleted: false,
    status: { is_terminal: false, code: { notIn: TERMINAL_CODES } },
  };
}

async function countActiveOrders(promotionId) {
  return prisma.order.count({ where: activeOrdersWhere(promotionId) });
}

async function getDeletionCheck(id, req = null, { auditRefusal = false } = {}) {
  const promo = await prisma.promotion.findFirst({ where: { id }, select: { id: true, code: true, uses_count: true, is_deleted: true } });
  if (!promo) throw { statusCode: 404, message: 'Code promo introuvable' };

  const [count, orders] = await Promise.all([
    countActiveOrders(id),
    prisma.order.findMany({
      where: activeOrdersWhere(id),
      select: {
        id: true, created_at: true, total_ttc: true, discount_amount: true,
        status: { select: { code: true, name_fr: true } },
        customer: { select: { name: true, phone_number: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    }),
  ]);

  let reason = null;
  if (promo.is_deleted) reason = 'Ce code est déjà supprimé.';
  else if (count > 0) reason = `Suppression refusée : ${count} commande(s) en cours référencent ce code. Désactivez-le à la place.`;
  else if (promo.uses_count > 0) reason = `Suppression refusée : ce code a déjà été utilisé ${promo.uses_count} fois. Désactivez-le à la place pour garder l'historique des remises lisible.`;

  const result = {
    id: promo.id,
    code: promo.code,
    uses_count: promo.uses_count,
    active_orders_count: count,
    active_orders: orders.map((o) => ({
      order_id: o.id,
      order_number: `ORD-${o.id.slice(0, 8).toUpperCase()}`,
      created_at: o.created_at,
      status_code: o.status?.code,
      status_label: o.status?.name_fr,
      customer_name: o.customer?.name,
      customer_phone: o.customer?.phone_number,
      total_ttc: Number(o.total_ttc),
      discount_amount: Number(o.discount_amount),
    })),
    can_delete: !reason,
    reason,
  };

  if (auditRefusal && reason && !promo.is_deleted) {
    await audit(req, {
      action: 'DELETE_REFUSED', resource: RESOURCE, resource_id: id,
      new_values: { code: promo.code, uses_count: promo.uses_count, active_orders_count: count, reason },
    });
  }
  return result;
}

// ————————————————————————————————————————— Écriture

async function create(body, req = null) {
  const { fields, promoType } = await parseFields(body);
  const data = {
    code: fields.code,
    promo_type_id: fields.promo_type_id,
    value: fields.value ?? 0,
    max_discount: fields.max_discount ?? null,
    min_order_amount: fields.min_order_amount ?? 0,
    is_combined: fields.is_combined ?? false,
    customer_id: fields.customer_id ?? null,
    node_id: fields.node_id ?? null,
    uses_max: fields.uses_max ?? null,
    uses_per_user_max: fields.uses_per_user_max ?? 1,
    valid_from: fields.valid_from,
    valid_to: fields.valid_to,
    is_active: fields.is_active ?? true,
  };
  await validateFull(data, promoType?.code);

  const created = await prisma.promotion.create({
    data: {
      ...data,
      uses_count: 0,
      is_gamification: false,
      play_id: null,
      referral_id: null,
    },
    include: ADMIN_INCLUDE,
  });

  await audit(req, { action: 'CREATE', resource: RESOURCE, resource_id: created.id, new_values: snapshot(created) });

  const formatted = formatAdmin(created);
  if (created.is_active) {
    notifyCouponCreated(formatted.customer_id, {
      code: formatted.code, type: formatted.type, value: formatted.value, min_order_amount: formatted.min_order_amount,
    }).catch(() => {});
  }
  return formatted;
}

async function refuse(req, id, action, message, extra = {}) {
  await audit(req, { action, resource: RESOURCE, resource_id: id, new_values: { reason: message, ...extra } });
  throw { statusCode: 400, message };
}

async function update(id, body, req = null) {
  const existing = await prisma.promotion.findFirst({ where: { id }, include: { promo_type: true } });
  if (!existing) throw { statusCode: 404, message: 'Code promo introuvable' };
  if (existing.is_deleted) {
    await refuse(req, id, 'UPDATE_REFUSED', 'Ce code promo est supprimé : il n\'est plus modifiable ni réactivable.');
  }

  const { fields, promoType } = await parseFields(body);
  const changed = changedKeys(fields, existing);
  if (!changed.length) return formatAdmin(await prisma.promotion.findUnique({ where: { id }, include: ADMIN_INCLUDE }));

  const origin = originOf(existing);
  if (origin !== 'manual') {
    const forbidden = changed.filter((k) => k !== 'is_active');
    if (forbidden.length) {
      await refuse(
        req, id, 'UPDATE_REFUSED',
        `Code généré automatiquement (origine ${ORIGIN_LABELS[origin]}) : ses paramètres sont en lecture seule. Seules la désactivation et la suppression sont possibles.`,
        { fields: forbidden },
      );
    }
  }

  const data = {};
  if (existing.uses_count > 0) {
    const forbidden = changed.filter((k) => !USED_EDITABLE.includes(k));
    if (forbidden.length) {
      await refuse(
        req, id, 'UPDATE_REFUSED',
        `Ce code a déjà été utilisé ${existing.uses_count} fois : seuls la date de fin, le nombre maximal d'utilisations et l'activation restent modifiables (champs refusés : ${forbidden.map((k) => FIELD_LABELS[k] ?? k).join(', ')}). Pour de nouvelles conditions, créez un nouveau code et désactivez celui-ci.`,
        { fields: forbidden },
      );
    }
    for (const k of changed) data[k] = fields[k];
    if (changed.includes('uses_max') && data.uses_max != null && data.uses_max < existing.uses_count) {
      await refuse(req, id, 'UPDATE_REFUSED', `Le nombre maximal d'utilisations doit être supérieur ou égal au nombre d'utilisations déjà constatées (${existing.uses_count}). Laissez vide pour illimité.`);
    }
    const end = data.valid_to ?? existing.valid_to;
    if (new Date(end) <= new Date(existing.valid_from)) {
      await refuse(req, id, 'UPDATE_REFUSED', 'La date de fin doit rester postérieure à la date de début');
    }
  } else {
    for (const k of changed) data[k] = fields[k];
    const merged = {
      code: existing.code, promo_type_id: existing.promo_type_id, value: Number(existing.value),
      node_id: existing.node_id, customer_id: existing.customer_id,
      valid_from: existing.valid_from, valid_to: existing.valid_to,
      ...data,
    };
    const typeCode = promoType?.code ?? existing.promo_type?.code;
    // Contrôle d'unicité uniquement si le code change (validateFull l'exclut sinon via currentId).
    await validateFull(merged, typeCode, id);
    if (typeCode === 'FREE_SHIPPING') data.value = 0;
    // Pas de re-vérification du node / client si inchangés : validateFull l'a fait sur la valeur fusionnée.
  }

  const updated = await prisma.promotion.update({ where: { id }, data, include: ADMIN_INCLUDE });
  await audit(req, {
    action: 'UPDATE', resource: RESOURCE, resource_id: id,
    old_values: snapshot(existing), new_values: snapshot(updated),
  });
  return formatAdmin(updated);
}

async function setActive(id, isActive, req = null) {
  const existing = await prisma.promotion.findFirst({ where: { id } });
  if (!existing) throw { statusCode: 404, message: 'Code promo introuvable' };
  if (existing.is_deleted) {
    await refuse(req, id, 'UPDATE_REFUSED', 'Ce code promo est supprimé : il ne peut plus être réactivé.');
  }
  const value = parseBool(isActive);
  if (existing.is_active === value) {
    return formatAdmin(await prisma.promotion.findUnique({ where: { id }, include: ADMIN_INCLUDE }));
  }
  const updated = await prisma.promotion.update({ where: { id }, data: { is_active: value }, include: ADMIN_INCLUDE });
  await audit(req, {
    action: value ? 'ACTIVATE' : 'DEACTIVATE', resource: RESOURCE, resource_id: id,
    old_values: { is_active: existing.is_active }, new_values: { is_active: value },
  });
  return formatAdmin(updated);
}

async function remove(id, req = null) {
  const check = await getDeletionCheck(id);
  if (!check.can_delete) {
    await audit(req, {
      action: 'DELETE_REFUSED', resource: RESOURCE, resource_id: id,
      new_values: { code: check.code, uses_count: check.uses_count, active_orders_count: check.active_orders_count, reason: check.reason },
    });
    throw { statusCode: 409, message: check.reason, details: check };
  }
  const existing = await prisma.promotion.findUnique({ where: { id } });
  const deleted = await prisma.promotion.update({
    where: { id },
    data: { is_deleted: true, deleted_at: new Date(), is_active: false },
  });
  await audit(req, { action: 'DELETE', resource: RESOURCE, resource_id: id, old_values: snapshot(existing), new_values: snapshot(deleted) });
  return { id };
}

// ————————————————————————————————————————— Utilisations (suivi) — US-115

function buildRedemptionWhere(query = {}) {
  const and = [{ promotion_id: { not: null } }, { is_deleted: false }];
  if (query.promotion_id) and.push({ promotion_id: String(query.promotion_id) });
  if (query.code) and.push({ promotion: { code: { contains: String(query.code), mode: 'insensitive' } } });
  if (query.customer) {
    and.push({
      OR: [
        { customer: { name: { contains: String(query.customer), mode: 'insensitive' } } },
        { customer: { phone_number: { contains: String(query.customer) } } },
      ],
    });
  }
  if (query.node_id) and.push({ node_id: String(query.node_id) });
  if (query.status) and.push({ status: { code: String(query.status) } });
  if (query.date_from) {
    const d = new Date(query.date_from);
    if (!Number.isNaN(d.getTime())) and.push({ created_at: { gte: d } });
  }
  if (query.date_to) {
    const d = new Date(query.date_to);
    if (!Number.isNaN(d.getTime())) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(query.date_to))) d.setHours(23, 59, 59, 999);
      and.push({ created_at: { lte: d } });
    }
  }
  return { AND: and };
}

const REDEMPTION_SELECT = {
  id: true, created_at: true, discount_amount: true, total_ttc: true, subtotal_ht: true, delivery_fee: true,
  customer: { select: { id: true, name: true, phone_country: true, phone_number: true } },
  node: { select: { id: true, code: true, name_fr: true } },
  status: { select: { code: true, name_fr: true, color: true, is_terminal: true } },
  promotion: { select: { id: true, code: true, value: true, promo_type: { select: { code: true, name_fr: true } } } },
};

function formatRedemption(o) {
  const statusCode = o.status?.code;
  return {
    order_id: o.id,
    order_number: `ORD-${o.id.slice(0, 8).toUpperCase()}`,
    created_at: o.created_at,
    customer_id: o.customer?.id,
    customer_name: o.customer?.name ?? null,
    customer_phone: o.customer ? `${o.customer.phone_country ?? ''}${o.customer.phone_number ?? ''}` : null,
    promotion_id: o.promotion?.id,
    code: o.promotion?.code,
    promo_type: o.promotion?.promo_type?.code,
    promo_type_label: o.promotion?.promo_type?.name_fr,
    promo_value: o.promotion ? Number(o.promotion.value) : null,
    discount_amount: Number(o.discount_amount),
    total_ttc: Number(o.total_ttc),
    node_id: o.node?.id,
    node_code: o.node?.code,
    node_name: o.node?.name_fr,
    status_code: statusCode,
    status_label: o.status?.name_fr ?? statusCode,
    status_color: o.status?.color,
    is_cancelled: statusCode === 'cancelled' || statusCode === 'returned',
  };
}

async function getRedemptions(query = {}) {
  const where = buildRedemptionWhere(query);
  const all = query.all === 'true' || query.all === true || query.export === 'true';
  const page  = Math.max(1, parseInt(query.page  ?? '1', 10) || 1);
  const limit = all ? 10000 : Math.min(500, Math.max(1, parseInt(query.limit ?? '20', 10) || 20));
  const skip  = all ? 0 : (page - 1) * limit;

  const cancelledWhere = { AND: [...where.AND, { status: { code: { in: ['cancelled', 'returned'] } } }] };
  const [rows, total, sums, cancelledSums] = await Promise.all([
    prisma.order.findMany({ where, select: REDEMPTION_SELECT, orderBy: { created_at: 'desc' }, skip, take: limit }),
    prisma.order.count({ where }),
    prisma.order.aggregate({ where, _sum: { discount_amount: true, total_ttc: true } }),
    prisma.order.aggregate({ where: cancelledWhere, _sum: { discount_amount: true }, _count: { _all: true } }),
  ]);

  const totalDiscount = round2(sums._sum.discount_amount);
  const cancelledDiscount = round2(cancelledSums._sum.discount_amount);
  const pagination = { total, page: all ? 1 : page, limit, pages: Math.ceil(total / limit) || 0 };
  return {
    data: rows.map(formatRedemption),
    pagination,
    meta: pagination,
    totals: {
      orders_count: total,
      total_discount: totalDiscount,
      total_ttc: round2(sums._sum.total_ttc),
      cancelled_count: cancelledSums._count._all,
      cancelled_discount: cancelledDiscount,
      effective_discount: round2(totalDiscount - cancelledDiscount),
    },
  };
}

async function getRedemptionOrder(orderId) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, promotion_id: { not: null } },
    select: {
      ...REDEMPTION_SELECT,
      wallet_used: true, vat_amount: true, cancelled_reason: true, notes: true,
      items: {
        where: { parent_item_id: null },
        select: {
          id: true, qty: true, unit_price_sold: true, discount_amount: true, flash_sale_id: true,
          sku: { select: { sku_code: true, name_fr: true } },
          pack: { select: { name_fr: true } },
        },
      },
    },
  });
  if (!order) throw { statusCode: 404, message: 'Commande introuvable ou sans code promo' };
  return {
    ...formatRedemption(order),
    subtotal_ht: Number(order.subtotal_ht),
    delivery_fee: Number(order.delivery_fee),
    vat_amount: Number(order.vat_amount),
    wallet_used: Number(order.wallet_used),
    cancelled_reason: order.cancelled_reason,
    notes: order.notes,
    items: (order.items ?? []).map((it) => ({
      id: it.id,
      label: it.pack?.name_fr ?? it.sku?.name_fr ?? '—',
      sku_code: it.sku?.sku_code ?? null,
      is_pack: !!it.pack,
      qty: Number(it.qty),
      unit_price_sold: Number(it.unit_price_sold),
      discount_amount: Number(it.discount_amount),
      is_flash: !!it.flash_sale_id,
    })),
  };
}

module.exports = {
  getAll, getById, getLookups, searchCustomers,
  create, update, setActive, remove, getDeletionCheck,
  getRedemptions, getRedemptionOrder,
  // exposés pour tests
  _internals: { originOf, statusOf, editableFieldsOf, changedKeys },
};
