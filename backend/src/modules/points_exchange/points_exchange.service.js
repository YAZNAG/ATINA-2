const prisma = require('../../config/database');
const { audit } = require('../../utils/audit');

/**
 * Point Exchange — catalogue des SKU échangeables contre des points (WF #19, US-087..US-089).
 *  - 1 règle = 1 couple (node, SKU) ; node obligatoire, aucun scope global ;
 *  - SKU actif ET vendable sur le node (selling_rules.is_sellable = TRUE) ;
 *  - points_cost entier > 0 (pour 1 unité), max_qty_per_order > 0 facultatif (NULL = illimité) ;
 *  - unicité (node_id, sku_id) WHERE is_deleted = FALSE (index partiel en base) ;
 *  - modification non rétroactive : aucune commande ni points_transactions n'est touchée ;
 *  - supervision en lecture seule des lignes order_items.is_points_exchange = TRUE.
 */

const err = (statusCode, message, details) => ({ statusCode, message, ...(details ? { details } : {}) });

const RULE_INCLUDE = {
  node: { select: { id: true, code: true, name_fr: true, name_ar: true } },
  sku:  { select: { id: true, sku_code: true, name_fr: true, name_ar: true, is_active: true, is_deleted: true } },
};

function parsePositiveInt(v, label, { required = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) throw err(400, `${label} obligatoire`);
    return null;
  }
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw err(400, `${label} : entier strictement supérieur à 0 attendu`);
  return n;
}

function toBool(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

function snapshot(r) {
  if (!r) return null;
  return {
    node_id: r.node_id, sku_id: r.sku_id, points_cost: r.points_cost,
    max_qty_per_order: r.max_qty_per_order, is_active: r.is_active, is_deleted: r.is_deleted,
  };
}

async function assertNode(nodeId) {
  if (!nodeId) throw err(400, 'Node obligatoire : une règle d\'échange est toujours rattachée à un seul node');
  const node = await prisma.node.findFirst({ where: { id: nodeId }, select: { id: true, is_deleted: true } }).catch(() => null);
  if (!node || node.is_deleted) throw err(400, 'Node introuvable');
}

/** SKU actif, non supprimé et vendable sur ce node (US-087). */
async function assertSkuSellable(nodeId, skuId) {
  if (!skuId) throw err(400, 'SKU obligatoire');
  const sku = await prisma.sku.findFirst({
    where:  { id: skuId },
    select: {
      id: true, sku_code: true, is_active: true, is_deleted: true,
      selling_rules: { where: { node_id: nodeId }, select: { is_sellable: true } },
    },
  }).catch(() => null);
  if (!sku) throw err(400, 'SKU introuvable');
  if (sku.is_deleted || !sku.is_active) throw err(400, `Le SKU ${sku.sku_code} est inactif ou supprimé`);
  if (!sku.selling_rules.length || !sku.selling_rules[0].is_sellable) {
    throw err(400, `Le SKU ${sku.sku_code} n'est pas vendable sur ce node (règle de vente absente ou non vendable)`);
  }
  return sku;
}

/** Unicité (node, SKU) parmi les règles non supprimées. */
async function assertUnique(nodeId, skuId, excludeId = null) {
  const existing = await prisma.pointsExchangeSku.findFirst({
    where: { node_id: nodeId, sku_id: skuId, is_deleted: false, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, is_active: true, points_cost: true },
  });
  if (existing) {
    throw err(409,
      `Une règle d'échange existe déjà pour ce couple (node, SKU) (${existing.is_active ? 'active' : 'inactive'}, ${existing.points_cost} pts). Modifiez-la ou supprimez-la avant d'en créer une nouvelle.`,
      { existing_id: existing.id });
  }
}

function isUniqueViolation(e) {
  return e && (e.code === 'P2002' || /points_exchange_skus_node_sku_active_key/.test(String(e.message)));
}

/** Enrichit les règles avec la vendabilité actuelle du SKU sur leur node (warning). */
async function withSellability(rules) {
  if (!rules.length) return [];
  const pairs = await prisma.sellingRule.findMany({
    where:  { OR: rules.map(r => ({ node_id: r.node_id, sku_id: r.sku_id })) },
    select: { node_id: true, sku_id: true, is_sellable: true },
  });
  const key = (n, s) => `${n}|${s}`;
  const map = Object.fromEntries(pairs.map(p => [key(p.node_id, p.sku_id), p.is_sellable]));
  return rules.map(r => {
    const sellable = map[key(r.node_id, r.sku_id)] === true && r.sku?.is_active !== false && !r.sku?.is_deleted;
    return {
      ...r,
      sku_sellable: sellable,
      warning: sellable ? null : 'SKU plus vendable sur ce node : la ligne sera refusée à la confirmation de commande',
    };
  });
}

// ─── Lecture ─────────────────────────────────────────────────────────────────

async function list(query = {}) {
  const where = {};
  if (query.status === 'deleted') where.is_deleted = true;
  else {
    where.is_deleted = false;
    if (query.status === 'active')   where.is_active = true;
    if (query.status === 'inactive') where.is_active = false;
  }
  if (query.node_id) where.node_id = query.node_id;
  if (query.sku_id)  where.sku_id  = query.sku_id;
  if (query.search) {
    const s = String(query.search).trim();
    where.sku = {
      OR: [
        { sku_code: { contains: s, mode: 'insensitive' } },
        { name_fr:  { contains: s, mode: 'insensitive' } },
        { name_ar:  { contains: s, mode: 'insensitive' } },
      ],
    };
  }

  const all   = query.all === 'true' || query.all === true;
  const page  = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
  const limit = all ? 5000 : Math.min(200, Math.max(1, parseInt(query.limit ?? '20', 10) || 20));

  const [rows, total] = await Promise.all([
    prisma.pointsExchangeSku.findMany({
      where, include: RULE_INCLUDE,
      orderBy: [{ created_at: 'desc' }],
      skip: all ? 0 : (page - 1) * limit, take: limit,
    }),
    prisma.pointsExchangeSku.count({ where }),
  ]);

  return {
    data: await withSellability(rows),
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

async function getById(id) {
  const rule = await prisma.pointsExchangeSku.findFirst({ where: { id }, include: RULE_INCLUDE }).catch(() => null);
  if (!rule) throw err(404, 'Règle d\'échange introuvable');
  const [enriched] = await withSellability([rule]);
  return enriched;
}

/** SKU proposables : actifs, non supprimés et vendables sur le node choisi (US-087 §2). */
async function eligibleSkus(query = {}) {
  const nodeId = query.node_id;
  if (!nodeId) throw err(400, 'Node obligatoire');
  const where = {
    is_deleted: false,
    is_active: true,
    selling_rules: { some: { node_id: nodeId, is_sellable: true } },
  };
  if (query.search) {
    const s = String(query.search).trim();
    where.OR = [
      { sku_code: { contains: s, mode: 'insensitive' } },
      { name_fr:  { contains: s, mode: 'insensitive' } },
      { name_ar:  { contains: s, mode: 'insensitive' } },
      { ean13:    { contains: s } },
    ];
  }
  const skus = await prisma.sku.findMany({
    where,
    take: Math.min(100, parseInt(query.limit ?? '30', 10) || 30),
    orderBy: { name_fr: 'asc' },
    select: {
      id: true, sku_code: true, name_fr: true, name_ar: true,
      points_exchange_skus: { where: { node_id: nodeId, is_deleted: false }, select: { id: true } },
    },
  });
  return skus.map(s => ({
    id: s.id, sku_code: s.sku_code, name_fr: s.name_fr, name_ar: s.name_ar,
    existing_rule_id: s.points_exchange_skus[0]?.id ?? null,
  }));
}

// ─── Écriture ────────────────────────────────────────────────────────────────

async function create(body, req) {
  const nodeId = body.node_id;
  const skuId  = body.sku_id;
  await assertNode(nodeId);
  if (!skuId) throw err(400, 'SKU obligatoire');
  const pointsCost = parsePositiveInt(body.points_cost, 'Coût en points', { required: true });
  const maxQty = parsePositiveInt(body.max_qty_per_order, 'Quantité max par commande');
  const isActive = body.is_active === undefined ? true : toBool(body.is_active);

  await assertSkuSellable(nodeId, skuId);
  await assertUnique(nodeId, skuId);

  try {
    return await prisma.$transaction(async (tx) => {
      const rule = await tx.pointsExchangeSku.create({
        data: {
          node_id: nodeId, sku_id: skuId, points_cost: pointsCost,
          max_qty_per_order: maxQty, is_active: isActive,
          created_by: req.user?.id ?? null,
        },
        include: RULE_INCLUDE,
      });
      await audit(req, { action: 'CREATE', resource: 'points_exchange_skus', resource_id: rule.id, new_values: snapshot(rule) }, tx);
      return rule;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw err(409, 'Une règle d\'échange existe déjà pour ce couple (node, SKU)');
    throw e;
  }
}

async function findActiveRule(id) {
  const rule = await prisma.pointsExchangeSku.findFirst({ where: { id, is_deleted: false } }).catch(() => null);
  if (!rule) throw err(404, 'Règle d\'échange introuvable');
  return rule;
}

/** Modification NON rétroactive (US-088) : seul le tarif de catalogue change. */
async function update(id, body, req) {
  const existing = await findActiveRule(id);
  const data = {};

  if (body.node_id !== undefined) {
    if (!body.node_id) throw err(400, 'Le node d\'une règle d\'échange ne peut jamais être vidé');
    data.node_id = body.node_id;
  }
  if (body.sku_id !== undefined) {
    if (!body.sku_id) throw err(400, 'SKU obligatoire');
    data.sku_id = body.sku_id;
  }
  const nodeId = data.node_id ?? existing.node_id;
  const skuId  = data.sku_id  ?? existing.sku_id;
  const pairChanged = nodeId !== existing.node_id || skuId !== existing.sku_id;
  if (pairChanged) {
    await assertNode(nodeId);
    await assertSkuSellable(nodeId, skuId);
    await assertUnique(nodeId, skuId, id);
  }

  if (body.points_cost !== undefined) data.points_cost = parsePositiveInt(body.points_cost, 'Coût en points', { required: true });
  if (body.max_qty_per_order !== undefined) data.max_qty_per_order = parsePositiveInt(body.max_qty_per_order, 'Quantité max par commande');
  if (body.is_active !== undefined) {
    data.is_active = toBool(body.is_active);
    if (data.is_active && !existing.is_active && !pairChanged) await assertSkuSellable(nodeId, skuId);
  }

  if (!Object.keys(data).length) return getById(id);

  try {
    return await prisma.$transaction(async (tx) => {
      const rule = await tx.pointsExchangeSku.update({ where: { id }, data, include: RULE_INCLUDE });
      const onlyToggle = Object.keys(data).length === 1 && 'is_active' in data;
      await audit(req, {
        action: onlyToggle ? (data.is_active ? 'ACTIVATE' : 'DEACTIVATE') : 'UPDATE',
        resource: 'points_exchange_skus', resource_id: id,
        old_values: snapshot(existing), new_values: snapshot(rule),
      }, tx);
      return rule;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw err(409, 'Une règle d\'échange existe déjà pour ce couple (node, SKU)');
    throw e;
  }
}

async function setActive(id, isActive, req) {
  return update(id, { is_active: !!isActive }, req);
}

async function remove(id, req) {
  const existing = await findActiveRule(id);
  await prisma.$transaction(async (tx) => {
    await tx.pointsExchangeSku.update({
      where: { id },
      data:  { is_deleted: true, deleted_at: new Date(), is_active: false },
    });
    await audit(req, {
      action: 'DELETE', resource: 'points_exchange_skus', resource_id: id,
      old_values: snapshot(existing), new_values: { is_deleted: true, is_active: false },
    }, tx);
  });
  return { id };
}

/**
 * Duplication vers un ou plusieurs nodes (WF #19 §11) : une règle par node cible,
 * mêmes coût et plafond, créée INACTIVE par défaut. Les nodes où le SKU n'est pas vendable
 * ou déjà configuré sont ignorés avec la raison.
 */
async function duplicate(id, body, req) {
  const source = await findActiveRule(id);
  const targets = [...new Set([...(Array.isArray(body.node_ids) ? body.node_ids : []), ...(body.node_id ? [body.node_id] : [])])];
  if (!targets.length) throw err(400, 'Node cible obligatoire');
  const isActive = body.is_active === undefined ? false : toBool(body.is_active);

  const created = [];
  const skipped = [];
  for (const nodeId of targets) {
    try {
      if (nodeId === source.node_id) throw err(400, 'Node identique au node source');
      await assertNode(nodeId);
      await assertSkuSellable(nodeId, source.sku_id);
      await assertUnique(nodeId, source.sku_id);
      const rule = await prisma.$transaction(async (tx) => {
        const r = await tx.pointsExchangeSku.create({
          data: {
            node_id: nodeId, sku_id: source.sku_id, points_cost: source.points_cost,
            max_qty_per_order: source.max_qty_per_order, is_active: isActive,
            created_by: req.user?.id ?? null,
          },
          include: RULE_INCLUDE,
        });
        await audit(req, {
          action: 'DUPLICATE', resource: 'points_exchange_skus', resource_id: r.id,
          old_values: { source_id: source.id, source_node_id: source.node_id },
          new_values: snapshot(r),
        }, tx);
        return r;
      });
      created.push(rule);
    } catch (e) {
      if (!e?.statusCode && !isUniqueViolation(e)) throw e;
      skipped.push({ node_id: nodeId, reason: isUniqueViolation(e) ? 'Règle déjà existante pour ce couple (node, SKU)' : e.message });
    }
  }

  if (!created.length) {
    throw err(400, `Aucune règle dupliquée : ${skipped.map(s => s.reason).join(' ; ')}`, { created, skipped });
  }
  return { created, skipped };
}

// ─── Supervision des échanges (lecture seule, US-089) ────────────────────────

async function exchanges(query = {}) {
  const where = { is_deleted: false, items: { some: { is_points_exchange: true } } };
  if (query.node_id)     where.node_id = query.node_id;
  if (query.customer_id) where.customer_id = query.customer_id;
  if (query.status)      where.status = { code: query.status };
  if (query.customer) {
    const s = String(query.customer).trim();
    where.customer = {
      OR: [
        { name: { contains: s, mode: 'insensitive' } },
        { phone_number: { contains: s } },
      ],
    };
  }
  if (query.date_from || query.date_to) {
    where.created_at = {};
    if (query.date_from) where.created_at.gte = new Date(query.date_from);
    if (query.date_to) {
      const to = new Date(query.date_to);
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(query.date_to))) to.setHours(23, 59, 59, 999);
      where.created_at.lte = to;
    }
  }
  if (query.sku_id) where.items = { some: { is_points_exchange: true, sku_id: query.sku_id } };

  const all   = query.all === 'true' || query.all === true;
  const page  = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
  const limit = all ? 5000 : Math.min(200, Math.max(1, parseInt(query.limit ?? '20', 10) || 20));

  const [orders, total, sums] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: all ? 0 : (page - 1) * limit, take: limit,
      select: {
        id: true, created_at: true, points_redeemed: true,
        node:     { select: { id: true, code: true, name_fr: true } },
        customer: { select: { id: true, name: true, phone_country: true, phone_number: true } },
        status:   { select: { code: true, name_fr: true, color: true, is_terminal: true } },
        items: {
          where:  { is_points_exchange: true },
          select: { id: true, qty: true, points_spent: true, sku: { select: { id: true, sku_code: true, name_fr: true } } },
        },
        points_transactions: {
          where:   { type: { in: ['sku_exchange', 'exchange_revert'] } },
          select:  { id: true, type: true, points: true, label: true, created_at: true },
          orderBy: { created_at: 'asc' },
        },
      },
    }),
    prisma.order.count({ where }),
    prisma.orderItem.aggregate({
      where: { is_points_exchange: true, order: where, ...(query.sku_id ? { sku_id: query.sku_id } : {}) },
      _sum: { points_spent: true, qty: true },
      _count: { _all: true },
    }),
  ]);

  const data = orders.map(o => ({
    order_id: o.id,
    created_at: o.created_at,
    node: o.node,
    customer: o.customer,
    status: o.status,
    points_redeemed: o.points_redeemed,
    lines_points_total: o.items.reduce((s, it) => s + Number(it.points_spent ?? 0), 0),
    lines: o.items.map(it => ({
      id: it.id, sku: it.sku, qty: Number(it.qty), points_spent: it.points_spent,
    })),
    transactions: o.points_transactions,
  }));

  return {
    data,
    summary: {
      orders: total,
      lines: sums._count._all,
      qty: Number(sums._sum.qty ?? 0),
      points_spent: Number(sums._sum.points_spent ?? 0),
    },
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

module.exports = {
  list, getById, eligibleSkus, create, update, setActive, remove, duplicate, exchanges,
};
