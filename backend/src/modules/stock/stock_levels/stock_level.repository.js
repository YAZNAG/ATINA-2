const prisma = require('../../../config/database');

// Returns ALL active articles for a node, joined with stock level + threshold rule
const findByNode = async (node_id) => {
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
        id:              level?.id ?? null,
        node_id,
        sku_id:          a.sku_uuid,
        qty_physical:    Number(level?.qty_physical    ?? 0),
        qty_reserved:    Number(level?.qty_reserved    ?? 0),
        qty_available:   Number(level?.qty_available   ?? 0),
        qty_backordered: Number(level?.qty_backordered ?? 0),
        qty_incoming:    Number(level?.qty_incoming    ?? 0),
        qty_floating_cod:Number(level?.qty_floating_cod?? 0),
        last_move_id:    level?.last_move_id  ?? null,
        last_counted_at: level?.last_counted_at ?? null,
        updated_at:      level?.updated_at ?? null,
        has_record:      level !== null,
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
        threshold_rule: rulesMap[a.sku_uuid] ?? null,
      };
    });
};

const findOne = (node_id, sku_id) =>
  prisma.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });

// Upsert a StockLevel — called after computing all new values in the service
const upsert = (node_id, sku_id, data) =>
  prisma.stockLevel.upsert({
    where:  { node_id_sku_id: { node_id, sku_id } },
    update: data,
    create: { node_id, sku_id, ...data },
  });

// Creates a StockMove record and updates the level atomically
const applyMove = async (node_id, sku_id, qty_delta, move_type_id, reference, metadata) => {
  return prisma.$transaction(async (tx) => {
    const current = await tx.stockLevel.findUnique({
      where: { node_id_sku_id: { node_id, sku_id } },
    });

    const old_physical = Number(current?.qty_physical    ?? 0);
    const old_reserved = Number(current?.qty_reserved    ?? 0);
    const old_back     = Number(current?.qty_backordered ?? 0);

    let new_physical = old_physical + qty_delta;
    if (new_physical < 0) new_physical = 0;

    // On positive receipt, allocate backorders first
    let new_back     = old_back;
    let new_reserved = old_reserved;
    if (qty_delta > 0 && old_back > 0) {
      const allocated = Math.min(qty_delta, old_back);
      new_back     -= allocated;
      new_reserved += allocated;
    }

    const new_available = Math.max(0, new_physical - new_reserved);

    const move = await tx.stockMove.create({
      data: {
        node_id,
        sku_id,
        move_type_id: move_type_id ?? null,
        qty_delta,
        reference: reference ?? null,
        metadata:  metadata  ?? null,
      },
    });

    const level = await tx.stockLevel.upsert({
      where:  { node_id_sku_id: { node_id, sku_id } },
      update: {
        qty_physical:    new_physical,
        qty_reserved:    new_reserved,
        qty_available:   new_available,
        qty_backordered: new_back,
        last_move_id:    move.id,
        updated_at:      new Date(),
      },
      create: {
        node_id,
        sku_id,
        qty_physical:    new_physical,
        qty_reserved:    new_reserved,
        qty_available:   new_available,
        qty_backordered: new_back,
        last_move_id:    move.id,
      },
    });

    return { move, level };
  });
};

// Admin manual adjustment — sets qty_physical directly (creates a correction move)
const adminAdjust = async (node_id, sku_id, new_qty_physical, move_type_id, reference) => {
  return prisma.$transaction(async (tx) => {
    const current = await tx.stockLevel.findUnique({
      where: { node_id_sku_id: { node_id, sku_id } },
    });

    const old_physical = Number(current?.qty_physical ?? 0);
    const reserved     = Number(current?.qty_reserved ?? 0);
    const backordered  = Number(current?.qty_backordered ?? 0);
    const qty_delta    = new_qty_physical - old_physical;

    const new_available = Math.max(0, new_qty_physical - reserved);

    const move = await tx.stockMove.create({
      data: {
        node_id,
        sku_id,
        move_type_id: move_type_id ?? null,
        qty_delta,
        reference:    reference ?? 'Ajustement manuel',
      },
    });

    const level = await tx.stockLevel.upsert({
      where:  { node_id_sku_id: { node_id, sku_id } },
      update: {
        qty_physical:  new_qty_physical,
        qty_available: new_available,
        last_move_id:  move.id,
        last_counted_at: new Date(),
        updated_at:    new Date(),
      },
      create: {
        node_id,
        sku_id,
        qty_physical:    new_qty_physical,
        qty_reserved:    0,
        qty_available:   new_qty_physical,
        qty_backordered: 0,
        qty_incoming:    0,
        qty_floating_cod:0,
        last_move_id:    move.id,
        last_counted_at: new Date(),
      },
    });

    return { move, level, qty_delta };
  });
};

module.exports = { findByNode, findOne, upsert, applyMove, adminAdjust };
