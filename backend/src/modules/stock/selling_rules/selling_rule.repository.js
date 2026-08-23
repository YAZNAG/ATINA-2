const prisma = require('../../../config/database');

const N = (v) => Number(v ?? 0);

// ─── Enriched list (articles + selling rule + qty_available) ─────────────────

const findWithFilters = async ({
  node_id, sku_id, category_id,
  backorderable, limit_reached, out_of_stock, sellable,
} = {}) => {
  const articleWhere = { is_active: true, is_deleted: false, sku_uuid: { not: null } };
  if (category_id) articleWhere.category_id = category_id;
  if (sku_id)      articleWhere.sku_uuid = sku_id;

  const articles = await prisma.article.findMany({
    where: articleWhere,
    include: {
      catalog_sku: { include: { images: { where: { is_primary: true }, take: 1 } } },
      images:       { where: { is_main: true }, take: 1 },
      family:       { select: { id: true, name_fr: true, code: true } },
      category:     { select: { id: true, name_fr: true, code: true } },
      sub_category: { select: { id: true, name_fr: true, code: true } },
    },
    orderBy: { name_fr: 'asc' },
  });

  const skuIds = articles.map((a) => a.sku_uuid).filter(Boolean);
  if (!skuIds.length) return [];

  const levelWhere  = { sku_id: { in: skuIds } };
  const ruleWhere   = { sku_id: { in: skuIds } };
  if (node_id) { levelWhere.node_id = node_id; ruleWhere.node_id = node_id; }

  const [levels, rules] = await Promise.all([
    prisma.stockLevel.findMany({ where: levelWhere }),
    prisma.sellingRule.findMany({ where: ruleWhere }),
  ]);

  const levelsMap = Object.fromEntries(levels.map((l) => [l.sku_id, l]));
  const rulesMap  = Object.fromEntries(rules.map((r)  => [r.sku_id, r]));

  let rows = articles
    .filter((a) => a.catalog_sku)
    .map((a) => {
      const level = levelsMap[a.sku_uuid] ?? null;
      const rule  = rulesMap[a.sku_uuid]  ?? null;
      const price = N(rule?.price);
      const is_sellable = rule?.is_sellable ?? true;
      return {
        rule_id:              rule?.id ?? null,
        node_id:              node_id ?? rule?.node_id ?? null,
        sku_id:               a.sku_uuid,
        is_sellable,
        price,
        is_vendable:          Boolean(is_sellable && price > 0),
        is_backorderable:     rule?.is_backorderable    ?? true,
        backorder_limit:      N(rule?.backorder_limit),
        backordered_quantity: N(rule?.backordered_quantity),
        estimated_restock_days: rule?.estimated_restock_days ?? 1,
        updated_at:           rule?.updated_at ?? null,
        has_rule:             rule !== null,
        qty_available:        N(level?.qty_available),
        qty_physical:         N(level?.qty_physical),
        qty_backordered:      N(level?.qty_backordered),
        has_stock_level:      level !== null,
        sku: {
          id:     a.catalog_sku.id,
          images: a.catalog_sku.images,
          article: {
            id:           a.id,
            sku_code:     a.sku_code,
            ean13:        a.ean13,
            name_fr:      a.name_fr,
            name_ar:      a.name_ar,
            family:       a.family,
            category:     a.category,
            sub_category: a.sub_category,
            images:       a.images,
          },
        },
      };
    });

  if (sellable === 'true' || sellable === true)   rows = rows.filter((r) => r.is_vendable);
  if (sellable === 'false' || sellable === false)  rows = rows.filter((r) => !r.is_vendable);
  if (backorderable === 'true'  || backorderable === true)  rows = rows.filter((r) => r.is_backorderable);
  if (backorderable === 'false' || backorderable === false) rows = rows.filter((r) => !r.is_backorderable);
  if (out_of_stock  === 'true'  || out_of_stock === true)  rows = rows.filter((r) => r.qty_available <= 0);
  if (limit_reached === 'true'  || limit_reached === true)
    rows = rows.filter((r) => r.is_backorderable && r.backorder_limit > 0 && r.backordered_quantity >= r.backorder_limit);

  return rows;
};

const findAllBySku = (sku_id) =>
  prisma.sellingRule.findMany({
    where: { sku_id },
    include: { node: { select: { id: true, code: true, name_fr: true, is_active: true } } },
    orderBy: { node: { name_fr: 'asc' } },
  });

const findByNode = (node_id) => findWithFilters({ node_id });
const findById = (id) => prisma.sellingRule.findUnique({ where: { id } });
const findOne = (node_id, sku_id) =>
  prisma.sellingRule.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });

// ─── Mutations ────────────────────────────────────────────────────────────────

const upsert = (node_id, sku_id, data) =>
  prisma.sellingRule.upsert({
    where:  { node_id_sku_id: { node_id, sku_id } },
    update: data,
    create: { node_id, sku_id, ...data },
  });

const update = (id, data) => prisma.sellingRule.update({ where: { id }, data });
const remove = (id) => prisma.sellingRule.delete({ where: { id } });

// ─── Business logic ───────────────────────────────────────────────────────────

const canSellSKU = async (node_id, sku_id, requested_qty) => {
  const [rule, level] = await Promise.all([
    prisma.sellingRule.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } }),
    prisma.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } }),
  ]);

  const qty_available  = N(level?.qty_available);
  const qty_backordered = N(rule?.backordered_quantity);
  const restock_days    = rule?.estimated_restock_days ?? 1;
  const price           = N(rule?.price);
  const is_sellable     = rule?.is_sellable ?? true;

  const estimatedDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + restock_days);
    return d;
  };

  if (!rule || !is_sellable || price <= 0) {
    return {
      allowed: false, mode: 'BLOCKED',
      available_qty: qty_available, backorder_qty: qty_backordered,
      estimated_restock_days: restock_days, estimated_available_date: null,
      reason: 'not_sellable',
    };
  }

  if (qty_available >= requested_qty) {
    return {
      allowed: true, mode: 'NORMAL',
      available_qty: qty_available, backorder_qty: qty_backordered,
      estimated_restock_days: restock_days, estimated_available_date: null,
      reason: 'in_stock',
    };
  }

  if (!rule.is_backorderable) {
    return {
      allowed: false, mode: 'BLOCKED',
      available_qty: qty_available, backorder_qty: qty_backordered,
      estimated_restock_days: restock_days, estimated_available_date: null,
      reason: 'out_of_stock',
    };
  }

  const limit = N(rule.backorder_limit);
  if (limit > 0 && qty_backordered + requested_qty > limit) {
    return {
      allowed: false, mode: 'BLOCKED',
      available_qty: qty_available, backorder_qty: qty_backordered,
      estimated_restock_days: restock_days, estimated_available_date: null,
      reason: 'backorder_limit_reached',
    };
  }

  return {
    allowed: true, mode: 'BACKORDER',
    available_qty: qty_available, backorder_qty: qty_backordered,
    estimated_restock_days: restock_days, estimated_available_date: estimatedDate(),
    reason: 'backorder',
  };
};

const reserveBackorder = async (node_id, sku_id, qty) => {
  const rule = await prisma.sellingRule.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });
  const current = N(rule?.backordered_quantity);
  return prisma.sellingRule.upsert({
    where:  { node_id_sku_id: { node_id, sku_id } },
    update: { backordered_quantity: current + qty },
    create: { node_id, sku_id, backordered_quantity: qty },
  });
};

const releaseBackorder = async (node_id, sku_id, qty) => {
  const rule = await prisma.sellingRule.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });
  const current = N(rule?.backordered_quantity);
  return prisma.sellingRule.upsert({
    where:  { node_id_sku_id: { node_id, sku_id } },
    update: { backordered_quantity: Math.max(0, current - qty) },
    create: { node_id, sku_id, backordered_quantity: 0 },
  });
};

const calculateEstimatedDelivery = async (node_id, sku_id) => {
  const rule = await prisma.sellingRule.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });
  const days = rule?.estimated_restock_days ?? 1;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return { estimated_delivery_date: date, estimated_restock_days: days };
};

const bulkSave = (rows) =>
  prisma.$transaction(
    rows.map(({ node_id, sku_id, is_sellable, price, is_backorderable, backorder_limit, estimated_restock_days }) => {
      const data = {};
      if (is_sellable !== undefined)         data.is_sellable         = Boolean(is_sellable);
      if (price !== undefined)               data.price               = Number(price);
      if (is_backorderable !== undefined)    data.is_backorderable    = Boolean(is_backorderable);
      if (backorder_limit !== undefined)     data.backorder_limit     = Number(backorder_limit);
      if (estimated_restock_days !== undefined) data.estimated_restock_days = parseInt(estimated_restock_days, 10);
      return prisma.sellingRule.upsert({
        where:  { node_id_sku_id: { node_id, sku_id } },
        update: data,
        create: { node_id, sku_id, ...data },
      });
    })
  );

module.exports = {
  findWithFilters, findByNode, findById, findOne,
  findAllBySku,
  upsert, update, remove, bulkSave,
  canSellSKU, reserveBackorder, releaseBackorder, calculateEstimatedDelivery,
};