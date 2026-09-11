const prisma = require('../../config/database');
const { audit } = require('../../utils/audit');

/**
 * Règles d'acquisition de points (points_rules) — WF#38 / WF#39, US-116 / US-117.
 * Règles GLOBALES (node_id NULL), cumulables, soft-delete, audit de chaque action.
 * Toute action n'agit que sur les calculs FUTURS : points_transactions n'est jamais touchée.
 */

const RULE_INCLUDE = {
  rule_type: { select: { id: true, code: true, name_fr: true, name_ar: true } },
  category: { select: { id: true, code: true, name_fr: true, name_ar: true, is_deleted: true } },
};

const RULE_CODES = ['per_spend', 'flat_bonus', 'category_multiplier', 'first_order'];
const bad = (message) => ({ statusCode: 400, message });

function validityState(rule, now = new Date()) {
  if (rule.valid_to && new Date(rule.valid_to) <= now) return 'expired';
  if (new Date(rule.valid_from) > now) return 'upcoming';
  return 'current';
}

function snapshot(rule) {
  if (!rule) return null;
  return {
    rule_type: rule.rule_type?.code ?? rule.rule_type_id,
    category_id: rule.category_id,
    points_value: rule.points_value,
    per_mad_spent: rule.per_mad_spent != null ? Number(rule.per_mad_spent) : null,
    min_order_amount: Number(rule.min_order_amount ?? 0),
    valid_from: rule.valid_from,
    valid_to: rule.valid_to,
    is_active: rule.is_active,
    is_deleted: rule.is_deleted,
  };
}

async function decorate(rows) {
  const ids = [...new Set(rows.map((r) => r.created_by).filter((v) => v != null))];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, full_name: true } })
    : [];
  const byId = new Map(users.map((u) => [u.id, u.full_name]));
  const now = new Date();
  return rows.map((r) => ({
    ...r,
    per_mad_spent: r.per_mad_spent != null ? Number(r.per_mad_spent) : null,
    min_order_amount: Number(r.min_order_amount ?? 0),
    validity_state: validityState(r, now),
    created_by_name: r.created_by != null ? byId.get(r.created_by) ?? null : null,
  }));
}

function parseDate(v, label) {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw bad(`${label} invalide.`);
  return d;
}

/** Contrôles bloquants communs à la création et à la modification (US-116). */
async function normalize(input) {
  const ruleType = input.rule_type_id
    ? await prisma.pointsRuleType.findUnique({ where: { id: input.rule_type_id } })
    : input.rule_type_code
      ? await prisma.pointsRuleType.findUnique({ where: { code: input.rule_type_code } })
      : null;
  if (!ruleType) throw bad('Le type de règle est obligatoire.');
  const code = ruleType.code;
  if (!RULE_CODES.includes(code)) {
    throw bad(`Type de règle « ${code} » non géré par cet écran.`);
  }

  const pv = Number(input.points_value);
  if (input.points_value === '' || input.points_value == null || !Number.isFinite(pv)) {
    throw bad('Le nombre de points (points_value) est obligatoire.');
  }
  if (!Number.isInteger(pv)) throw bad('Le nombre de points doit être un entier.');
  if (pv <= 0) throw bad('Le nombre de points doit être strictement supérieur à 0.');

  let perMad = null;
  const rawPerMad = input.per_mad_spent;
  if (rawPerMad !== undefined && rawPerMad !== null && rawPerMad !== '') {
    perMad = Number(rawPerMad);
    if (!Number.isFinite(perMad) || perMad <= 0) throw bad('Le montant par tranche (per_mad_spent) doit être strictement supérieur à 0.');
    if (perMad > 999.99) throw bad('Le montant par tranche (per_mad_spent) ne peut pas dépasser 999,99 MAD.');
  }
  if (code === 'per_spend' && perMad == null) throw bad('Le montant par tranche en MAD (per_mad_spent) est obligatoire pour une règle « par montant dépensé ».');
  if (code === 'flat_bonus' || code === 'first_order') perMad = null;

  let categoryId = null;
  if (code === 'category_multiplier') {
    if (!input.category_id) throw bad('La catégorie est obligatoire pour une règle « multiplicateur catégorie ».');
    const cat = await prisma.category.findUnique({ where: { id: input.category_id }, select: { id: true, is_deleted: true } });
    if (!cat || cat.is_deleted) throw bad('Catégorie introuvable ou supprimée.');
    categoryId = cat.id;
  }

  let minOrder = 0;
  if (input.min_order_amount !== undefined && input.min_order_amount !== null && input.min_order_amount !== '') {
    minOrder = Number(input.min_order_amount);
    if (!Number.isFinite(minOrder)) throw bad('Montant minimum de commande invalide.');
    if (minOrder < 0) throw bad('Le montant minimum de commande doit être supérieur ou égal à 0.');
  }

  const validFrom = parseDate(input.valid_from, 'Date de début');
  if (!validFrom) throw bad('La date de début de validité (valid_from) est obligatoire.');
  const validTo = parseDate(input.valid_to, 'Date de fin');
  if (validTo && validTo <= validFrom) throw bad('La date de fin doit être postérieure à la date de début.');

  return {
    data: {
      rule_type_id: ruleType.id,
      category_id: categoryId,
      points_value: pv,
      per_mad_spent: perMad,
      min_order_amount: minOrder,
      valid_from: validFrom,
      valid_to: validTo,
    },
    ruleType,
  };
}

class PointsRulesService {
  async list(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 25));
    const now = new Date();
    const where = { rule_type: { code: { in: RULE_CODES } } };
    const AND = [];

    if (query.status === 'deleted') where.is_deleted = true;
    else {
      where.is_deleted = false;
      if (query.status === 'active') where.is_active = true;
      if (query.status === 'inactive') where.is_active = false;
    }
    if (query.rule_type && RULE_CODES.includes(String(query.rule_type))) where.rule_type = { code: String(query.rule_type) };
    if (query.validity === 'current') {
      AND.push({ valid_from: { lte: now } }, { OR: [{ valid_to: null }, { valid_to: { gt: now } }] });
    } else if (query.validity === 'upcoming') {
      AND.push({ valid_from: { gt: now } });
    } else if (query.validity === 'expired') {
      AND.push({ valid_to: { lte: now } });
    }
    if (AND.length) where.AND = AND;

    const [rows, total] = await Promise.all([
      prisma.pointsRule.findMany({
        where,
        include: RULE_INCLUDE,
        orderBy: [{ is_active: 'desc' }, { created_at: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.pointsRule.count({ where }),
    ]);
    return { data: await decorate(rows), pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
  }

  async get(id) {
    const rule = await prisma.pointsRule.findUnique({ where: { id }, include: RULE_INCLUDE });
    if (!rule) throw { statusCode: 404, message: 'Règle de points introuvable.' };
    const [decorated] = await decorate([rule]);
    const usage = await prisma.pointsTransaction.count({ where: { label: { contains: `[rule:${id}]` } } });
    return { ...decorated, transactions_count: usage };
  }

  async create(req, body) {
    const { data } = await normalize(body || {});
    const isActive = body?.is_active === undefined ? true : body.is_active === true || body.is_active === 'true';
    if (isActive && data.valid_to && data.valid_to <= new Date()) {
      throw bad('Impossible de créer une règle active dont la période de validité est déjà expirée.');
    }
    const created = await prisma.$transaction(async (tx) => {
      const rule = await tx.pointsRule.create({
        data: { ...data, node_id: null, is_active: isActive, created_by: req.user?.id ?? null },
        include: RULE_INCLUDE,
      });
      await audit(req, { action: 'CREATE', resource: 'points_rules', resource_id: rule.id, new_values: snapshot(rule) }, tx);
      return rule;
    });
    return (await decorate([created]))[0];
  }

  async update(req, id, body) {
    const existing = await prisma.pointsRule.findUnique({ where: { id }, include: RULE_INCLUDE });
    if (!existing) throw { statusCode: 404, message: 'Règle de points introuvable.' };
    if (existing.is_deleted) throw bad('Règle supprimée : elle ne peut plus être modifiée.');

    const merged = {
      rule_type_id: existing.rule_type_id,
      category_id: existing.category_id,
      points_value: existing.points_value,
      per_mad_spent: existing.per_mad_spent != null ? Number(existing.per_mad_spent) : null,
      min_order_amount: Number(existing.min_order_amount ?? 0),
      valid_from: existing.valid_from,
      valid_to: existing.valid_to,
      ...Object.fromEntries(Object.entries(body || {}).filter(([, v]) => v !== undefined)),
    };
    if (body?.rule_type_code && !body?.rule_type_id) delete merged.rule_type_id;
    const { data } = await normalize(merged);

    const updated = await prisma.$transaction(async (tx) => {
      const rule = await tx.pointsRule.update({ where: { id }, data, include: RULE_INCLUDE });
      await audit(req, {
        action: 'UPDATE', resource: 'points_rules', resource_id: id,
        old_values: snapshot(existing), new_values: snapshot(rule),
      }, tx);
      return rule;
    });
    return (await decorate([updated]))[0];
  }

  async setActive(req, id, active) {
    const existing = await prisma.pointsRule.findUnique({ where: { id }, include: RULE_INCLUDE });
    if (!existing) throw { statusCode: 404, message: 'Règle de points introuvable.' };
    if (existing.is_deleted) throw bad('Règle supprimée : elle ne peut plus être réactivée ni désactivée.');
    if (active && existing.valid_to && existing.valid_to <= new Date()) {
      throw bad('Réactivation refusée : la période de validité de cette règle est expirée. Modifiez la date de fin ou créez une nouvelle règle.');
    }
    if (existing.is_active === active) return (await decorate([existing]))[0];

    const updated = await prisma.$transaction(async (tx) => {
      const rule = await tx.pointsRule.update({ where: { id }, data: { is_active: active }, include: RULE_INCLUDE });
      await audit(req, {
        action: active ? 'ACTIVATE' : 'DEACTIVATE', resource: 'points_rules', resource_id: id,
        old_values: { is_active: existing.is_active }, new_values: { is_active: active },
      }, tx);
      return rule;
    });
    return (await decorate([updated]))[0];
  }

  async remove(req, id) {
    const existing = await prisma.pointsRule.findUnique({ where: { id }, include: RULE_INCLUDE });
    if (!existing) throw { statusCode: 404, message: 'Règle de points introuvable.' };
    if (existing.is_deleted) throw bad('Cette règle est déjà supprimée.');
    await prisma.$transaction(async (tx) => {
      await tx.pointsRule.update({
        where: { id },
        data: { is_deleted: true, deleted_at: new Date(), is_active: false },
      });
      await audit(req, {
        action: 'DELETE', resource: 'points_rules', resource_id: id,
        old_values: snapshot(existing), new_values: { is_deleted: true, is_active: false },
      }, tx);
    });
    return { id };
  }
}

module.exports = new PointsRulesService();
