const prisma = require('../../../config/database');

const SKU_INCLUDE = {
  article: {
    include: {
      images:       { where: { is_main: true }, take: 1 },
      family:       { select: { id: true, name_fr: true, code: true } },
      category:     { select: { id: true, name_fr: true, code: true } },
      sub_category: { select: { id: true, name_fr: true, code: true } },
    },
  },
  images: { where: { is_primary: true }, take: 1 },
};

const findByNode = async (node_id) => {
  const [levels, rules] = await Promise.all([
    prisma.stockLevel.findMany({
      where:   { node_id },
      include: { sku: { include: SKU_INCLUDE } },
      orderBy: [{ sku: { article: { name_fr: 'asc' } } }],
    }),
    prisma.stockThresholdRule.findMany({ where: { node_id } }),
  ]);
  const rulesMap = Object.fromEntries(rules.map((r) => [r.sku_id, r]));
  return levels.map((sl) => ({ ...sl, threshold_rule: rulesMap[sl.sku_id] ?? null }));
};

const findById      = (id)             => prisma.stockThresholdRule.findUnique({ where: { id } });
const findByNodeSku = (node_id, sku_id) =>
  prisma.stockThresholdRule.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });

const create = (data)        => prisma.stockThresholdRule.create({ data });
const update = (id, data)    => prisma.stockThresholdRule.update({ where: { id }, data });
const remove = (id)          => prisma.stockThresholdRule.delete({ where: { id } });

const bulkUpsert = (node_id, rows) => {
  const ops = rows.map((r) =>
    prisma.stockThresholdRule.upsert({
      where:  { node_id_sku_id: { node_id, sku_id: r.sku_id } },
      update: {
        stock_minimum:         r.stock_minimum,
        stock_alert_threshold: r.stock_alert_threshold,
        stock_maximum:         r.stock_maximum,
        reorder_quantity:      r.reorder_quantity,
        auto_restock_enabled:  r.auto_restock_enabled,
        is_active:             r.is_active,
      },
      create: {
        node_id,
        sku_id:                r.sku_id,
        stock_minimum:         r.stock_minimum,
        stock_alert_threshold: r.stock_alert_threshold,
        stock_maximum:         r.stock_maximum,
        reorder_quantity:      r.reorder_quantity,
        auto_restock_enabled:  r.auto_restock_enabled,
        is_active:             r.is_active,
      },
    })
  );
  return prisma.$transaction(ops);
};

module.exports = { findByNode, findById, findByNodeSku, create, update, remove, bulkUpsert };
