const prisma = require('../../../config/database');

const N = (v) => Number(v ?? 0);
const avail = (phys, res) => Math.max(0, phys - res);

// ─── Queries ──────────────────────────────────────────────────────────────────

const getOrCreate = (node_id, sku_id) =>
  prisma.stockLevel.upsert({
    where:  { node_id_sku_id: { node_id, sku_id } },
    update: {},
    create: { node_id, sku_id },
  });

const findById = (id) =>
  prisma.stockLevel.findUnique({ where: { id } });

const findAllBySku = (sku_id) =>
  prisma.stockLevel.findMany({
    where: { sku_id },
    include: { node: { select: { id: true, code: true, name_fr: true, is_active: true } } },
    orderBy: { node: { name_fr: 'asc' } },
  });

const findOne = (node_id, sku_id) =>
  prisma.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });

// Returns article-joined rows with level + threshold data, supports filters
const findWithFilters = async ({
  node_id, sku_id, category_id,
  out_of_stock, low_stock, backordered, has_incoming, has_cod,
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

  const levelWhere = { sku_id: { in: skuIds } };
  if (node_id) levelWhere.node_id = node_id;

  const [levels, rules] = await Promise.all([
    prisma.stockLevel.findMany({ where: levelWhere }),
    prisma.stockThresholdRule.findMany({ where: levelWhere }),
  ]);

  const levelsMap = Object.fromEntries(levels.map((l) => [l.sku_id, l]));
  const rulesMap  = Object.fromEntries(rules.map((r)  => [r.sku_id, r]));

  let rows = articles
    .filter((a) => a.catalog_sku)
    .map((a) => {
      const level = levelsMap[a.sku_uuid] ?? null;
      const rule  = rulesMap[a.sku_uuid]  ?? null;
      return {
        id:               level?.id ?? null,
        node_id:          node_id ?? level?.node_id ?? null,
        sku_id:           a.sku_uuid,
        qty_physical:     N(level?.qty_physical),
        qty_reserved:     N(level?.qty_reserved),
        qty_available:    N(level?.qty_available),
        qty_backordered:  N(level?.qty_backordered),
        qty_incoming:     N(level?.qty_incoming),
        qty_floating_cod: N(level?.qty_floating_cod),
        last_move_id:     level?.last_move_id  ?? null,
        last_counted_at:  level?.last_counted_at ?? null,
        updated_at:       level?.updated_at ?? null,
        has_record:       level !== null,
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
        threshold_rule: rule,
      };
    });

  // Level-based boolean filters
  if (out_of_stock === 'true' || out_of_stock === true)
    rows = rows.filter((r) => r.qty_available <= 0);
  if (low_stock === 'true' || low_stock === true)
    rows = rows.filter((r) => {
      const min = N(r.threshold_rule?.stock_minimum);
      return r.qty_available > 0 && min > 0 && r.qty_available <= min;
    });
  if (backordered === 'true' || backordered === true)
    rows = rows.filter((r) => r.qty_backordered > 0);
  if (has_incoming === 'true' || has_incoming === true)
    rows = rows.filter((r) => r.qty_incoming > 0);
  if (has_cod === 'true' || has_cod === true)
    rows = rows.filter((r) => r.qty_floating_cod > 0);

  return rows;
};

const findByNode = (node_id) => findWithFilters({ node_id });

// ─── Mutations (all in $transaction) ─────────────────────────────────────────

// Receipt: +qty_physical, backorder → reserved, -qty_incoming + CREATE stock_lot (FIFO)
const applyReceipt = async (node_id, sku_id, qty, move_type_id, reference, { cost_unit = 0, lot_number = null, expiry_date = null } = {}) =>
  prisma.$transaction(async (tx) => {
    const cur = await tx.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });
    const old_phys = N(cur?.qty_physical);
    const old_res  = N(cur?.qty_reserved);
    const old_back = N(cur?.qty_backordered);
    const old_inc  = N(cur?.qty_incoming);

    const new_phys  = old_phys + qty;
    const allocated = cur && old_back > 0 ? Math.min(qty, old_back) : 0;
    const new_res   = old_res  + allocated;
    const new_back  = old_back - allocated;
    const new_inc   = Math.max(0, old_inc - qty);
    const new_avail = avail(new_phys, new_res);

    const lot = await tx.stockLot.create({
      data: {
        sku_id, node_id,
        qty_initial:   qty,
        qty_remaining: qty,
        cost_unit:     Number(cost_unit),
        lot_number:    lot_number ?? null,
        expiry_date:   expiry_date ? new Date(expiry_date) : null,
      },
    });
    const move = await tx.stockMove.create({
      data: { node_id, sku_id, move_type_id: move_type_id ?? null, lot_id: lot.id, qty_delta: qty, reference: reference ?? 'Réception' },
    });
    const level = await tx.stockLevel.upsert({
      where:  { node_id_sku_id: { node_id, sku_id } },
      update: { qty_physical: new_phys, qty_reserved: new_res, qty_available: new_avail, qty_backordered: new_back, qty_incoming: new_inc, last_move_id: move.id, updated_at: new Date() },
      create: { node_id, sku_id, qty_physical: new_phys, qty_reserved: new_res, qty_available: new_avail, qty_backordered: new_back, qty_incoming: new_inc, last_move_id: move.id },
    });
    return { move, level, lot };
  });

// Reserve: available → reserved; overflow → backordered
const reserveForOrder = async (node_id, sku_id, requested_qty) =>
  prisma.$transaction(async (tx) => {
    const cur = await tx.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });
    const phys = N(cur?.qty_physical);
    const res  = N(cur?.qty_reserved);
    const back = N(cur?.qty_backordered);
    const cur_avail = N(cur?.qty_available);

    const reservable        = Math.min(requested_qty, cur_avail);
    const backordered_delta = requested_qty - reservable;
    const new_res   = res  + reservable;
    const new_back  = back + backordered_delta;
    const new_avail = avail(phys, new_res);

    const level = await tx.stockLevel.upsert({
      where:  { node_id_sku_id: { node_id, sku_id } },
      update: { qty_reserved: new_res, qty_available: new_avail, qty_backordered: new_back, updated_at: new Date() },
      create: { node_id, sku_id, qty_reserved: new_res, qty_available: new_avail, qty_backordered: new_back },
    });
    return { level, reserved: reservable, backordered: backordered_delta };
  });

// Picking: -qty_physical, -qty_reserved
const completePicking = async (node_id, sku_id, qty, move_type_id) =>
  prisma.$transaction(async (tx) => {
    const cur = await tx.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });
    const new_phys = Math.max(0, N(cur?.qty_physical) - qty);
    const new_res  = Math.max(0, N(cur?.qty_reserved)  - qty);
    const new_avail = avail(new_phys, new_res);

    const move = await tx.stockMove.create({
      data: { node_id, sku_id, move_type_id: move_type_id ?? null, qty_delta: -qty, reference: 'Picking' },
    });
    const level = await tx.stockLevel.upsert({
      where:  { node_id_sku_id: { node_id, sku_id } },
      update: { qty_physical: new_phys, qty_reserved: new_res, qty_available: new_avail, last_move_id: move.id, updated_at: new Date() },
      create: { node_id, sku_id, qty_physical: new_phys, qty_reserved: new_res, qty_available: new_avail, last_move_id: move.id },
    });
    return { move, level };
  });

// Cancel reservation: release reserved (or backorder)
const cancelReservation = async (node_id, sku_id, qty, is_backorder = false) =>
  prisma.$transaction(async (tx) => {
    const cur = await tx.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });
    const phys = N(cur?.qty_physical);
    const new_res  = is_backorder ? N(cur?.qty_reserved) : Math.max(0, N(cur?.qty_reserved) - qty);
    const new_back = is_backorder ? Math.max(0, N(cur?.qty_backordered) - qty) : N(cur?.qty_backordered);
    const new_avail = avail(phys, new_res);

    const level = await tx.stockLevel.upsert({
      where:  { node_id_sku_id: { node_id, sku_id } },
      update: { qty_reserved: new_res, qty_available: new_avail, qty_backordered: new_back, updated_at: new Date() },
      create: { node_id, sku_id, qty_reserved: new_res, qty_available: new_avail, qty_backordered: new_back },
    });
    return { level };
  });

// Update incoming stock (purchase order created/cancelled)
const updateIncoming = async (node_id, sku_id, qty_delta) =>
  prisma.$transaction(async (tx) => {
    const cur = await tx.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });
    const new_inc = Math.max(0, N(cur?.qty_incoming) + qty_delta);
    const level = await tx.stockLevel.upsert({
      where:  { node_id_sku_id: { node_id, sku_id } },
      update: { qty_incoming: new_inc, updated_at: new Date() },
      create: { node_id, sku_id, qty_incoming: new_inc },
    });
    return { level };
  });

// COD delivered to customer (in transit): -physical/-reserved, +floating_cod
const confirmCODDelivered = async (node_id, sku_id, qty) =>
  prisma.$transaction(async (tx) => {
    const cur = await tx.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });
    const new_phys = Math.max(0, N(cur?.qty_physical) - qty);
    const new_res  = Math.max(0, N(cur?.qty_reserved) - qty);
    const new_cod  = N(cur?.qty_floating_cod) + qty;
    const new_avail = avail(new_phys, new_res);

    const level = await tx.stockLevel.upsert({
      where:  { node_id_sku_id: { node_id, sku_id } },
      update: { qty_physical: new_phys, qty_reserved: new_res, qty_available: new_avail, qty_floating_cod: new_cod, updated_at: new Date() },
      create: { node_id, sku_id, qty_physical: new_phys, qty_reserved: new_res, qty_available: new_avail, qty_floating_cod: new_cod },
    });
    return { level };
  });

// COD collected (payment received): -floating_cod (order finalized)
const confirmCODCollected = async (node_id, sku_id, qty) =>
  prisma.$transaction(async (tx) => {
    const cur = await tx.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });
    const new_cod = Math.max(0, N(cur?.qty_floating_cod) - qty);
    const level = await tx.stockLevel.upsert({
      where:  { node_id_sku_id: { node_id, sku_id } },
      update: { qty_floating_cod: new_cod, updated_at: new Date() },
      create: { node_id, sku_id, qty_floating_cod: new_cod },
    });
    return { level };
  });

// Mark inventory count timestamp
const updateLastCountedAt = async (node_id, sku_id) => {
  const level = await prisma.stockLevel.upsert({
    where:  { node_id_sku_id: { node_id, sku_id } },
    update: { last_counted_at: new Date(), updated_at: new Date() },
    create: { node_id, sku_id, last_counted_at: new Date() },
  });
  return { level };
};

// Admin manual adjustment — sets qty_physical directly (creates correction move)
const adminAdjust = async (node_id, sku_id, new_qty_physical, move_type_id, reference) =>
  prisma.$transaction(async (tx) => {
    const cur = await tx.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });
    const old_phys  = N(cur?.qty_physical);
    const reserved  = N(cur?.qty_reserved);
    const qty_delta = new_qty_physical - old_phys;
    const new_avail = avail(new_qty_physical, reserved);

    const move = await tx.stockMove.create({
      data: { node_id, sku_id, move_type_id: move_type_id ?? null, qty_delta, reference: reference ?? 'Ajustement manuel' },
    });
    const level = await tx.stockLevel.upsert({
      where:  { node_id_sku_id: { node_id, sku_id } },
      update: { qty_physical: new_qty_physical, qty_available: new_avail, last_move_id: move.id, last_counted_at: new Date(), updated_at: new Date() },
      create: { node_id, sku_id, qty_physical: new_qty_physical, qty_available: new_avail, last_counted_at: new Date(), last_move_id: move.id },
    });
    return { move, level, qty_delta };
  });

// Recalculate qty_available = max(0, qty_physical - qty_reserved) for all levels
const recalculate = async (node_id) => {
  const where = node_id ? { node_id } : {};
  const levels = await prisma.stockLevel.findMany({ where });
  let fixed = 0;
  for (const l of levels) {
    const expected = avail(N(l.qty_physical), N(l.qty_reserved));
    if (Math.abs(N(l.qty_available) - expected) > 0.0001) {
      await prisma.stockLevel.update({ where: { id: l.id }, data: { qty_available: expected, updated_at: new Date() } });
      fixed++;
    }
  }
  return { recalculated: fixed, total: levels.length };
};

// Generic move (legacy / direct use)
const applyMove = async (node_id, sku_id, qty_delta, move_type_id, reference, metadata) =>
  prisma.$transaction(async (tx) => {
    const cur = await tx.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });
    const old_phys = N(cur?.qty_physical);
    const old_res  = N(cur?.qty_reserved);
    const old_back = N(cur?.qty_backordered);

    let new_phys = Math.max(0, old_phys + qty_delta);
    const allocated = qty_delta > 0 && old_back > 0 ? Math.min(qty_delta, old_back) : 0;
    const new_res   = old_res  + allocated;
    const new_back  = old_back - allocated;
    const new_avail = avail(new_phys, new_res);

    const move = await tx.stockMove.create({
      data: { node_id, sku_id, move_type_id: move_type_id ?? null, qty_delta, reference: reference ?? null, metadata: metadata ?? null },
    });
    const level = await tx.stockLevel.upsert({
      where:  { node_id_sku_id: { node_id, sku_id } },
      update: { qty_physical: new_phys, qty_reserved: new_res, qty_available: new_avail, qty_backordered: new_back, last_move_id: move.id, updated_at: new Date() },
      create: { node_id, sku_id, qty_physical: new_phys, qty_reserved: new_res, qty_available: new_avail, qty_backordered: new_back, last_move_id: move.id },
    });
    return { move, level };
  });

module.exports = {
  getOrCreate, findById, findOne, findByNode, findWithFilters,
  findAllBySku,
  applyReceipt, reserveForOrder, completePicking, cancelReservation,
  updateIncoming, confirmCODDelivered, confirmCODCollected, updateLastCountedAt,
  adminAdjust, recalculate, applyMove,
};
