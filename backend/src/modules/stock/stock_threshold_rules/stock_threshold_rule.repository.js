const prisma = require('../../../config/database');

// findByNode — returns ALL active articles (with or without stock level) for the given node
const findByNode = async (node_id) => {
  // All active articles that have a linked SKU
  const articles = await prisma.article.findMany({
    where: { is_active: true, is_deleted: false, sku_uuid: { not: null } },
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

  const [levels, rules] = await Promise.all([
    prisma.stockLevel.findMany({ where: { node_id, sku_id: { in: skuIds } } }),
    prisma.stockThresholdRule.findMany({ where: { node_id, sku_id: { in: skuIds } } }),
  ]);

  const levelsMap = Object.fromEntries(levels.map((l) => [l.sku_id, l]));
  const rulesMap  = Object.fromEntries(rules.map((r)  => [r.sku_id, r]));

  return articles
    .filter((a) => a.catalog_sku)
    .map((a) => {
      const level = levelsMap[a.sku_uuid] ?? null;
      return {
        id:            level?.id ?? null,
        node_id,
        sku_id:        a.sku_uuid,
        qty_physical:  Number(level?.qty_physical  ?? 0),
        qty_reserved:  Number(level?.qty_reserved  ?? 0),
        qty_available: Number(level?.qty_available ?? 0),
        qty_incoming:  Number(level?.qty_incoming  ?? 0),
        has_stock:     level !== null,
        sku: {
          id:      a.catalog_sku.id,
          images:  a.catalog_sku.images,
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
        threshold_rule: rulesMap[a.sku_uuid] ?? null,
      };
    });
};

const findById      = (id)              => prisma.stockThresholdRule.findUnique({ where: { id } });
const findByNodeSku = (node_id, sku_id) =>
  prisma.stockThresholdRule.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });

const create = (data)     => prisma.stockThresholdRule.create({ data });
const update = (id, data) => prisma.stockThresholdRule.update({ where: { id }, data });
const remove = (id)       => prisma.stockThresholdRule.delete({ where: { id } });

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
