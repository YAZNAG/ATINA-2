const prisma = require('../../../config/database');

// findByNode — renvoie tous les SKU actifs (avec ou sans niveau de stock) pour le node.
// La table `articles` a ete fusionnee dans `skus` : tout est lu sur le SKU.
const findByNode = async (node_id) => {
  const skus = await prisma.sku.findMany({
    where: { is_active: true, is_deleted: false },
    include: {
      images:       { where: { deleted_at: null }, orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }], take: 1 },
      sku_family:   { select: { id: true, name_fr: true, code: true } },
      category:     { select: { id: true, name_fr: true, code: true } },
      sku_subfamily:{ select: { id: true, name_fr: true, code: true } },
    },
    orderBy: { name_fr: 'asc' },
  });

  const skuIds = skus.map((s) => s.id);

  const [levels, rules] = await Promise.all([
    prisma.stockLevel.findMany({ where: { node_id, sku_id: { in: skuIds } } }),
    prisma.stockThresholdRule.findMany({ where: { node_id, sku_id: { in: skuIds } } }),
  ]);

  const levelsMap = Object.fromEntries(levels.map((l) => [l.sku_id, l]));
  const rulesMap  = Object.fromEntries(rules.map((r)  => [r.sku_id, r]));

  return skus.map((s) => {
    const level = levelsMap[s.id] ?? null;
    // `article` reste expose pour les ecrans existants du back-office.
    const identity = {
      id:           s.id,
      sku_code:     s.sku_code,
      ean13:        s.ean13,
      name_fr:      s.name_fr,
      name_ar:      s.name_ar,
      family:       s.sku_family,
      category:     s.category,
      sub_category: s.sku_subfamily,
      images:       s.images,
    };
    return {
      id:            level?.id ?? null,
      node_id,
      sku_id:        s.id,
      qty_physical:  Number(level?.qty_physical  ?? 0),
      qty_reserved:  Number(level?.qty_reserved  ?? 0),
      qty_available: Number(level?.qty_available ?? 0),
      qty_incoming:  Number(level?.qty_incoming  ?? 0),
      has_stock:     level !== null,
      sku: { ...identity, article: identity },
      threshold_rule: rulesMap[s.id] ?? null,
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
