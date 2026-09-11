const prisma = require('../../config/database');
const { audit } = require('../../utils/audit');
const { refFilter } = require('./points-ledger.util');

/**
 * Programme de parrainage — WF#6 / WF#26 / WF#37, US-084 / US-085 / US-104.
 *  - referral_config : configuration GLOBALE (node_id NULL), une seule active,
 *    immuable dès qu'un parrainage la référence ;
 *  - referrals : suivi en LECTURE ; la colonne « Récompense » est déduite de la
 *    configuration figée (config_id) et du statut, sans lire points_transactions
 *    ni promotions (ces tables ne sont lues qu'au détail, pour l'audit, par la
 *    colonne points_transactions.referral_id) ;
 *  - liste paginée par KEYSET (created_at DESC, id DESC), jamais d'OFFSET.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPORT_MAX = 20000;
const bad = (message) => ({ statusCode: 400, message });

const CONFIG_INCLUDE = {
  referrer_type: { select: { id: true, code: true, name_fr: true } },
  referee_type: { select: { id: true, code: true, name_fr: true } },
  promo_type: { select: { id: true, code: true, name_fr: true } },
  creator: { select: { id: true, full_name: true } },
  _count: { select: { referrals: true } },
};

const REFERRAL_INCLUDE = {
  referrer: { select: { id: true, name: true, phone_country: true, phone_number: true } },
  referee: { select: { id: true, name: true, phone_country: true, phone_number: true } },
  status: { select: { code: true, name_fr: true } },
  qualifying_order: { select: { id: true, created_at: true, total_ttc: true } },
  config: {
    select: {
      id: true, referrer_reward_value: true, referee_reward_value: true, min_order_amount: true,
      max_referrals_per_user: true, valid_from: true, valid_to: true, promo_min_order_amount: true,
      promo_validity_days: true, is_active: true,
      referrer_type: { select: { code: true, name_fr: true } },
      referee_type: { select: { code: true, name_fr: true } },
      promo_type: { select: { code: true, name_fr: true } },
    },
  },
};

const fmtNumber = (v) => {
  const n = Number(v ?? 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
};

/** Libellé d'une valeur de récompense issue de la configuration (« 50 points », « Coupon -20 MAD »). */
function rewardValueLabel(typeCode, value, promoTypeCode) {
  if (typeCode === 'points') return `${fmtNumber(value)} points`;
  if (typeCode === 'promo_code') {
    if (promoTypeCode === 'PERCENTAGE') return `Coupon -${fmtNumber(value)} %`;
    if (promoTypeCode === 'FREE_SHIPPING') return 'Coupon livraison offerte';
    return `Coupon -${fmtNumber(value)} MAD`;
  }
  return '—';
}

/** Colonne unique « Récompense », pilotée par le statut (US-085 / US-104). */
function rewardDisplay(status, config, role) {
  if (!config) return { state: 'none', label: 'Aucune configuration liée' };
  const isReferrer = role === 'referrer';
  const typeCode = isReferrer ? config.referrer_type?.code : config.referee_type?.code;
  const value = isReferrer ? config.referrer_reward_value : config.referee_reward_value;
  const label = rewardValueLabel(typeCode, value, config.promo_type?.code);
  if (status === 'validated') return { state: 'paid', type: typeCode, label };
  if (status === 'pending') return { state: 'pending', type: typeCode, label: `En attente — ${label} à la livraison` };
  return { state: 'none', type: typeCode, label: 'Aucune récompense versée' };
}

function decorateReferral(r) {
  const status = r.status?.code;
  return {
    ...r,
    reward_amount: undefined,
    referrer_reward: rewardDisplay(status, r.config, 'referrer'),
    referee_reward: rewardDisplay(status, r.config, 'referee'),
    referrer_reward_type: r.config?.referrer_type ?? null,
    referee_reward_type: r.config?.referee_type ?? null,
  };
}

function decorateConfig(c, now = new Date()) {
  if (!c) return c;
  const used = c._count?.referrals ?? 0;
  let state = 'inactive';
  if (c.is_active) {
    if (c.valid_to && c.valid_to <= now) state = 'expired';
    else if (c.valid_from > now) state = 'upcoming';
    else state = 'active';
  }
  return {
    ...c,
    referrer_reward_value: Number(c.referrer_reward_value),
    referee_reward_value: Number(c.referee_reward_value),
    min_order_amount: Number(c.min_order_amount ?? 0),
    promo_min_order_amount: Number(c.promo_min_order_amount ?? 0),
    referrals_count: used,
    is_locked: used > 0,
    state,
    referrer_reward_label: rewardValueLabel(c.referrer_type?.code, c.referrer_reward_value, c.promo_type?.code),
    referee_reward_label: rewardValueLabel(c.referee_type?.code, c.referee_reward_value, c.promo_type?.code),
  };
}

function configSnapshot(c) {
  if (!c) return null;
  return {
    referrer_reward_type: c.referrer_type?.code ?? c.referrer_reward_type_id,
    referrer_reward_value: Number(c.referrer_reward_value),
    referee_reward_type: c.referee_type?.code ?? c.referee_reward_type_id,
    referee_reward_value: Number(c.referee_reward_value),
    promo_type: c.promo_type?.code ?? c.promo_type_id ?? null,
    promo_min_order_amount: Number(c.promo_min_order_amount ?? 0),
    promo_validity_days: c.promo_validity_days,
    min_order_amount: Number(c.min_order_amount ?? 0),
    max_referrals_per_user: c.max_referrals_per_user,
    valid_from: c.valid_from,
    valid_to: c.valid_to,
    is_active: c.is_active,
  };
}

function parseDate(v, label) {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw bad(`${label} invalide.`);
  return d;
}

function parseDay(v, label, endOfDay = false) {
  if (!v) return null;
  const s = String(v).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(s);
  if (Number.isNaN(d.getTime())) throw bad(`${label} invalide.`);
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(s)) d.setDate(d.getDate() + 1);
  return d;
}

async function resolveRewardType(value, who) {
  if (!value) throw bad(`Le type de récompense du ${who} est obligatoire.`);
  const rt = UUID_RE.test(String(value))
    ? await prisma.rewardType.findUnique({ where: { id: String(value) } })
    : await prisma.rewardType.findUnique({ where: { code: String(value) } });
  if (!rt || !['points', 'promo_code'].includes(rt.code)) throw bad(`Type de récompense du ${who} invalide (points ou code promo).`);
  return rt;
}

/** Contrôles de l'enregistrement d'une configuration (US-084). */
async function normalizeConfig(input) {
  const referrerType = await resolveRewardType(input.referrer_reward_type_id ?? input.referrer_reward_type, 'parrain');
  const refereeType = await resolveRewardType(input.referee_reward_type_id ?? input.referee_reward_type, 'filleul');

  const checkValue = (raw, type, who) => {
    if (raw === undefined || raw === null || raw === '') throw bad(`La valeur de la récompense du ${who} est obligatoire.`);
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) throw bad(`La valeur de la récompense du ${who} doit être strictement supérieure à 0.`);
    if (type.code === 'points' && !Number.isInteger(n)) throw bad(`La récompense du ${who} en points doit être un nombre entier.`);
    if (n > 9999999999) throw bad(`La valeur de la récompense du ${who} est trop élevée.`);
    return n;
  };
  const referrerValue = checkValue(input.referrer_reward_value, referrerType, 'parrain');
  const refereeValue = checkValue(input.referee_reward_value, refereeType, 'filleul');

  const hasPromo = referrerType.code === 'promo_code' || refereeType.code === 'promo_code';
  let promoTypeId = null;
  let promoMin = 0;
  let promoDays = 30;
  if (hasPromo) {
    const pt = input.promo_type_id
      ? await prisma.promoType.findUnique({ where: { id: String(input.promo_type_id) } })
      : input.promo_type_code ? await prisma.promoType.findUnique({ where: { code: String(input.promo_type_code) } }) : null;
    if (!pt) throw bad('Le type de promo est obligatoire lorsqu’une récompense est un code promo.');
    promoTypeId = pt.id;
    if (pt.code === 'PERCENTAGE') {
      if (referrerType.code === 'promo_code' && referrerValue > 100) throw bad('Un coupon en pourcentage ne peut pas dépasser 100 % (parrain).');
      if (refereeType.code === 'promo_code' && refereeValue > 100) throw bad('Un coupon en pourcentage ne peut pas dépasser 100 % (filleul).');
    }
    if (input.promo_min_order_amount !== undefined && input.promo_min_order_amount !== null && input.promo_min_order_amount !== '') {
      promoMin = Number(input.promo_min_order_amount);
      if (!Number.isFinite(promoMin) || promoMin < 0) throw bad('Le montant minimum de commande du coupon doit être supérieur ou égal à 0.');
    }
    if (input.promo_validity_days === undefined || input.promo_validity_days === null || input.promo_validity_days === '') {
      throw bad('La durée de validité du coupon (en jours) est obligatoire.');
    }
    promoDays = Number(input.promo_validity_days);
    if (!Number.isInteger(promoDays) || promoDays <= 0) throw bad('La durée de validité du coupon doit être un nombre entier de jours supérieur à 0.');
    if (promoDays > 32767) throw bad('La durée de validité du coupon est trop longue.');
  }

  let minOrder = 0;
  if (input.min_order_amount !== undefined && input.min_order_amount !== null && input.min_order_amount !== '') {
    minOrder = Number(input.min_order_amount);
    if (!Number.isFinite(minOrder) || minOrder < 0) throw bad('Le montant minimum de la première commande doit être supérieur ou égal à 0.');
  }

  let maxReferrals = null;
  if (input.max_referrals_per_user !== undefined && input.max_referrals_per_user !== null && input.max_referrals_per_user !== '') {
    maxReferrals = Number(input.max_referrals_per_user);
    if (!Number.isInteger(maxReferrals) || maxReferrals <= 0) throw bad('Le nombre maximal de parrainages par client doit être un entier supérieur à 0 (vide = illimité).');
    if (maxReferrals > 32767) throw bad('Le nombre maximal de parrainages par client est trop élevé.');
  }

  const validFrom = parseDate(input.valid_from, 'Date de début');
  if (!validFrom) throw bad('La date de début de validité (valid_from) est obligatoire.');
  const validTo = parseDate(input.valid_to, 'Date de fin');
  if (validTo && validTo <= validFrom) throw bad('La date de fin doit être postérieure à la date de début.');

  return {
    node_id: null,
    referrer_reward_type_id: referrerType.id,
    referrer_reward_value: referrerValue,
    referee_reward_type_id: refereeType.id,
    referee_reward_value: refereeValue,
    promo_type_id: promoTypeId,
    promo_min_order_amount: promoMin,
    promo_validity_days: promoDays,
    min_order_amount: minOrder,
    max_referrals_per_user: maxReferrals,
    valid_from: validFrom,
    valid_to: validTo,
  };
}

function referralWhere(query = {}) {
  const where = {};
  if (query.status) where.status = { code: String(query.status) };
  const from = parseDay(query.date_from, 'Date de début');
  const to = parseDay(query.date_to, 'Date de fin', true);
  if (from || to) where.created_at = { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) };
  if (query.config_id && UUID_RE.test(String(query.config_id))) where.config_id = String(query.config_id);
  if (query.search && String(query.search).trim()) {
    const s = String(query.search).trim();
    const cust = { OR: [{ name: { contains: s, mode: 'insensitive' } }, { phone_number: { contains: s } }] };
    where.OR = [{ referrer: cust }, { referee: cust }];
  }
  return where;
}

/** Condition keyset : lignes strictement après le curseur dans l'ordre (created_at DESC, id DESC). */
async function keysetAfter(cursor) {
  if (!cursor) return null;
  if (!UUID_RE.test(String(cursor))) throw bad('Curseur invalide.');
  const c = await prisma.referral.findUnique({ where: { id: String(cursor) }, select: { id: true, created_at: true } });
  if (!c) throw bad('Curseur invalide : parrainage introuvable.');
  return { OR: [{ created_at: { lt: c.created_at } }, { created_at: c.created_at, id: { lt: c.id } }] };
}

/** Une page keyset de parrainages (take + 1 pour savoir s'il reste des lignes). */
async function referralPage(where, cursor, limit) {
  const after = await keysetAfter(cursor);
  const rows = await prisma.referral.findMany({
    where: after ? { AND: [where, after] } : where,
    include: REFERRAL_INCLUDE,
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { rows: page, next_cursor: hasMore ? page[page.length - 1].id : null, has_more: hasMore };
}

function promoUsageStatus(p, now = new Date()) {
  if (p.is_deleted) return { code: 'deleted', label: 'Supprimé' };
  if (!p.is_active) return { code: 'disabled', label: 'Désactivé' };
  const usedCount = Math.max(Number(p.uses_count ?? 0), p._count?.redemptions ?? 0);
  if (p.uses_max != null && usedCount >= p.uses_max) return { code: 'used', label: 'Utilisé' };
  if (p.valid_to && new Date(p.valid_to) < now) return { code: 'expired', label: 'Expiré' };
  return { code: 'available', label: 'Disponible (non utilisé)' };
}

class ReferralsService {
  // ── Configurations ─────────────────────────────────────────────────────────
  async listConfigs() {
    const rows = await prisma.referralConfig.findMany({
      include: CONFIG_INCLUDE,
      orderBy: [{ is_active: 'desc' }, { created_at: 'desc' }],
    });
    const now = new Date();
    return rows.map((c) => decorateConfig(c, now));
  }

  async getConfig(id) {
    if (!UUID_RE.test(String(id))) throw bad('Identifiant de configuration invalide.');
    const c = await prisma.referralConfig.findUnique({ where: { id }, include: CONFIG_INCLUDE });
    if (!c) throw { statusCode: 404, message: 'Configuration de parrainage introuvable.' };
    return decorateConfig(c);
  }

  async createConfig(req, body = {}) {
    const data = await normalizeConfig(body);
    const activate = body.is_active === true || body.is_active === 'true';
    if (activate && data.valid_to && data.valid_to <= new Date()) {
      throw bad('Impossible d’activer une configuration dont la période de validité est déjà expirée.');
    }
    if (!req.user?.id) throw { statusCode: 401, message: 'Utilisateur back-office requis.' };

    const created = await prisma.$transaction(async (tx) => {
      let deactivated = [];
      if (activate) {
        deactivated = await tx.referralConfig.findMany({ where: { is_active: true }, select: { id: true } });
        await tx.referralConfig.updateMany({ where: { is_active: true }, data: { is_active: false } });
      }
      const cfg = await tx.referralConfig.create({
        data: { ...data, is_active: activate, created_by: req.user.id },
        include: CONFIG_INCLUDE,
      });
      await audit(req, { action: 'CREATE', resource: 'referral_config', resource_id: cfg.id, new_values: configSnapshot(cfg) }, tx);
      for (const d of deactivated) {
        // eslint-disable-next-line no-await-in-loop
        await audit(req, {
          action: 'DEACTIVATE', resource: 'referral_config', resource_id: d.id,
          old_values: { is_active: true }, new_values: { is_active: false, replaced_by: cfg.id },
        }, tx);
      }
      return cfg;
    });
    return decorateConfig(created);
  }

  async updateConfig(req, id, body = {}) {
    const existing = await prisma.referralConfig.findUnique({ where: { id }, include: CONFIG_INCLUDE });
    if (!existing) throw { statusCode: 404, message: 'Configuration de parrainage introuvable.' };
    const used = existing._count?.referrals ?? 0;
    if (used > 0) {
      throw bad(`Configuration utilisée par ${used} parrainage(s) : ses récompenses et conditions ne sont plus modifiables. Créez une nouvelle configuration.`);
    }
    const merged = {
      referrer_reward_type_id: existing.referrer_reward_type_id,
      referrer_reward_value: Number(existing.referrer_reward_value),
      referee_reward_type_id: existing.referee_reward_type_id,
      referee_reward_value: Number(existing.referee_reward_value),
      promo_type_id: existing.promo_type_id,
      promo_min_order_amount: Number(existing.promo_min_order_amount ?? 0),
      promo_validity_days: existing.promo_validity_days,
      min_order_amount: Number(existing.min_order_amount ?? 0),
      max_referrals_per_user: existing.max_referrals_per_user,
      valid_from: existing.valid_from,
      valid_to: existing.valid_to,
      ...Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)),
    };
    if (body.referrer_reward_type && !body.referrer_reward_type_id) delete merged.referrer_reward_type_id;
    if (body.referee_reward_type && !body.referee_reward_type_id) delete merged.referee_reward_type_id;
    const data = await normalizeConfig(merged);
    if (existing.is_active && data.valid_to && data.valid_to <= new Date()) {
      throw bad('Une configuration active ne peut pas avoir une date de fin déjà passée : désactivez-la d’abord.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Re-vérification dans la transaction : aucun parrainage ne doit l'avoir référencée entre-temps
      const again = await tx.referral.count({ where: { config_id: id } });
      if (again > 0) throw bad('Configuration utilisée entre-temps par un parrainage : créez une nouvelle configuration.');
      const cfg = await tx.referralConfig.update({ where: { id }, data, include: CONFIG_INCLUDE });
      await audit(req, {
        action: 'UPDATE', resource: 'referral_config', resource_id: id,
        old_values: configSnapshot(existing), new_values: configSnapshot(cfg),
      }, tx);
      return cfg;
    });
    return decorateConfig(updated);
  }

  async setConfigActive(req, id, active) {
    const existing = await prisma.referralConfig.findUnique({ where: { id }, include: CONFIG_INCLUDE });
    if (!existing) throw { statusCode: 404, message: 'Configuration de parrainage introuvable.' };
    if (active && existing.valid_to && existing.valid_to <= new Date()) {
      throw bad('Activation refusée : la période de validité de cette configuration est expirée. Créez une nouvelle configuration.');
    }
    if (existing.is_active === active) return decorateConfig(existing);

    const updated = await prisma.$transaction(async (tx) => {
      let deactivated = [];
      if (active) {
        deactivated = await tx.referralConfig.findMany({ where: { is_active: true, NOT: { id } }, select: { id: true } });
        await tx.referralConfig.updateMany({ where: { is_active: true, NOT: { id } }, data: { is_active: false } });
      }
      const cfg = await tx.referralConfig.update({ where: { id }, data: { is_active: active }, include: CONFIG_INCLUDE });
      await audit(req, {
        action: active ? 'ACTIVATE' : 'DEACTIVATE', resource: 'referral_config', resource_id: id,
        old_values: { is_active: existing.is_active }, new_values: { is_active: active },
      }, tx);
      for (const d of deactivated) {
        // eslint-disable-next-line no-await-in-loop
        await audit(req, {
          action: 'DEACTIVATE', resource: 'referral_config', resource_id: d.id,
          old_values: { is_active: true }, new_values: { is_active: false, replaced_by: id },
        }, tx);
      }
      return cfg;
    });
    return decorateConfig(updated);
  }

  // ── Suivi des parrainages ──────────────────────────────────────────────────
  /** Liste paginée par curseur (?cursor=<id du dernier parrainage affiché>), jamais d'OFFSET. */
  async listReferrals(query = {}) {
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 25));
    const where = referralWhere(query);
    const [pageRes, total] = await Promise.all([
      referralPage(where, query.cursor || null, limit),
      prisma.referral.count({ where }),
    ]);
    return {
      data: pageRes.rows.map(decorateReferral),
      pagination: { total, limit, next_cursor: pageRes.next_cursor, has_more: pageRes.has_more },
    };
  }

  /** Export : même périmètre que la liste filtrée, parcouru par keyset (plafond EXPORT_MAX lignes). */
  async exportReferrals(query = {}) {
    const where = referralWhere(query);
    const out = [];
    let cursor = null;
    while (out.length < EXPORT_MAX) {
      // eslint-disable-next-line no-await-in-loop
      const res = await referralPage(where, cursor, Math.min(1000, EXPORT_MAX - out.length));
      out.push(...res.rows.map(decorateReferral));
      if (!res.has_more) break;
      cursor = res.next_cursor;
    }
    return { items: out, truncated: out.length >= EXPORT_MAX, max: EXPORT_MAX };
  }

  /** Détail d'un parrainage : SEUL endroit où points_transactions et promotions sont lues. */
  async referralDetail(id) {
    if (!UUID_RE.test(String(id))) throw bad('Identifiant de parrainage invalide.');
    const r = await prisma.referral.findUnique({ where: { id }, include: REFERRAL_INCLUDE });
    if (!r) throw { statusCode: 404, message: 'Parrainage introuvable.' };
    const base = decorateReferral(r);

    const [pointsTxns, promos] = await Promise.all([
      // Récompenses versées : colonne points_transactions.referral_id (balise du libellé pour les anciennes lignes).
      prisma.pointsTransaction.findMany({
        where: refFilter('referral_id', id),
        select: {
          id: true, customer_id: true, points: true, created_at: true, reason: true,
          customer: { select: { id: true, name: true } },
          txn_type: { select: { code: true, name_fr: true, name_ar: true } },
        },
        orderBy: { created_at: 'asc' },
      }),
      prisma.promotion.findMany({
        where: { referral_id: id },
        select: {
          id: true, code: true, value: true, valid_from: true, valid_to: true, uses_max: true, uses_count: true,
          is_active: true, is_deleted: true, customer_id: true, created_at: true,
          customer: { select: { id: true, name: true } },
          promo_type: { select: { code: true, name_fr: true } },
          _count: { select: { redemptions: true } },
        },
        orderBy: { created_at: 'asc' },
      }),
    ]);

    const now = new Date();
    const roleOf = (customerId) => (customerId === r.referrer_id ? 'referrer' : customerId === r.referee_id ? 'referee' : null);
    const rewards = [
      ...pointsTxns.map((t) => ({
        kind: 'points', role: roleOf(t.customer_id), beneficiary: t.customer, amount: t.points,
        created_at: t.created_at, points_txn_id: t.id, reason: t.reason,
        txn_type: t.txn_type?.code ?? null, txn_type_label: t.txn_type?.name_fr ?? null,
      })),
      ...promos.map((p) => ({
        kind: 'promo_code', role: roleOf(p.customer_id), beneficiary: p.customer, promotion_id: p.id,
        code: p.code, value: Number(p.value), promo_type: p.promo_type,
        label: rewardValueLabel('promo_code', p.value, p.promo_type?.code),
        valid_from: p.valid_from, valid_to: p.valid_to, created_at: p.created_at,
        usage_status: promoUsageStatus(p, now),
      })),
    ];

    return {
      ...base,
      config: r.config ? decorateConfig({ ...r.config, _count: { referrals: 1 } }) : null,
      rewards,
    };
  }

  /** Onglet « Parrainages » de la fiche client : bloc Parrain (1:1) + bloc Filleuls (1:N). */
  async customerReferrals(customerId, query = {}) {
    if (!UUID_RE.test(String(customerId))) throw bad('Identifiant client invalide.');
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true, name: true, referral_code: true, referred_by_id: true,
        referred_by: { select: { id: true, name: true, phone_country: true, phone_number: true, referral_code: true } },
      },
    });
    if (!customer) throw { statusCode: 404, message: 'Client introuvable.' };

    // Parrain unique : customers.referred_by_id ; à défaut, le parrainage où ce client est filleul.
    let parrain = customer.referred_by ?? null;
    const asReferee = await prisma.referral.findFirst({
      where: { referee_id: customerId },
      include: REFERRAL_INCLUDE,
      orderBy: { created_at: 'asc' },
    });
    if (!parrain && asReferee) parrain = asReferee.referrer;

    const where = { referrer_id: customerId, ...referralWhere({ status: query.status, date_from: query.date_from, date_to: query.date_to }) };
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 25));
    const [rows, filteredTotal, total, validated] = await Promise.all([
      prisma.referral.findMany({
        where, include: REFERRAL_INCLUDE, orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit, take: limit,
      }),
      prisma.referral.count({ where }),
      prisma.referral.count({ where: { referrer_id: customerId } }),
      prisma.referral.count({ where: { referrer_id: customerId, status: { code: 'validated' } } }),
    ]);

    // Récompenses en points versées à CE client, lues par la colonne referral_id du livre
    // (clic « récompense points » → détail de la transaction dans le grand-livre).
    const refIds = [...rows.map((r) => r.id), ...(asReferee ? [asReferee.id] : [])];
    const txns = refIds.length ? await prisma.pointsTransaction.findMany({
      where: { customer_id: customerId, referral_id: { in: refIds } },
      select: { id: true, referral_id: true, points: true },
    }) : [];
    const txnByRef = new Map(txns.map((t) => [t.referral_id, t]));
    const withTxn = (d, reward) => {
      const t = txnByRef.get(d.id);
      return { ...d, reward, reward_txn_id: t?.id ?? null, reward_points: t?.points ?? null };
    };

    // Pour la fiche du client consulté, la récompense affichée est celle du parrain (ce client).
    const filleuls = rows.map((r) => {
      const d = decorateReferral(r);
      return withTxn(d, d.referrer_reward);
    });

    return {
      customer: { id: customer.id, name: customer.name, referral_code: customer.referral_code },
      parrain,
      parrainage_filleul: asReferee ? (() => { const d = decorateReferral(asReferee); return withTxn(d, d.referee_reward); })() : null,
      filleuls,
      counters: { filleuls: total, valides: validated },
      pagination: { total: filteredTotal, page, limit, pages: Math.ceil(filteredTotal / limit) || 1 },
    };
  }
}

module.exports = new ReferralsService();
module.exports.rewardValueLabel = rewardValueLabel;
module.exports.rewardDisplay = rewardDisplay;
