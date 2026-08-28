const prisma = require('../../../config/database');

const N = (v) => Number(v ?? 0);

// ─── Enriched list ───────────────────────────────────────────────────────────

const findWithFilters = async ({
  node_id, sku_id, category_id,
  low_stock, critical_stock, overstock, is_active, supplier_id,
} = {}) => {
  const skuWhere = { is_active: true, is_deleted: false };
  if (category_id) skuWhere.category_id = category_id;
  if (sku_id)      skuWhere.id = sku_id;


  let sellingRules = [];
  if (node_id) {
    sellingRules = await prisma.sellingRule.findMany({
      where: { node_id, is_sellable: true, ...(sku_id ? { sku_id } : {}) },
    });
    const sellableIds = sellingRules.map((sr) => sr.sku_id);
    if (!sellableIds.length) return [];
    skuWhere.id = sku_id ? sku_id : { in: sellableIds };
  }

  const skus = await prisma.sku.findMany({
    where: skuWhere,
    include: {
      images:     { where: { is_primary: true }, take: 1 },
      category:   { select: { id: true, name_fr: true, code: true } },
      sku_family: { select: { id: true, name_fr: true, code: true } },
    },
    orderBy: { name_fr: 'asc' },
  });

  const skuIds = skus.map((s) => s.id);
  if (!skuIds.length) return [];

  const levelWhere = { sku_id: { in: skuIds } };
  const ruleWhere  = { sku_id: { in: skuIds } };
  if (node_id) { levelWhere.node_id = node_id; ruleWhere.node_id = node_id; }
  if (supplier_id) ruleWhere.preferred_supplier_id = supplier_id;

  const [levels, rules] = await Promise.all([
    prisma.stockLevel.findMany({ where: levelWhere }),
    prisma.reorderRule.findMany({
      where: ruleWhere,
      include: {
        costing_method:     { select: { id: true, code: true, name_fr: true } },
        preferred_supplier: { select: { id: true, code: true, name_fr: true } },
      },
    }),
  ]);

  const levelsMap  = Object.fromEntries(levels.map((l) => [l.sku_id, l]));
  const rulesMap   = Object.fromEntries(rules.map((r)  => [r.sku_id, r]));
  const pricesMap  = Object.fromEntries(sellingRules.map((sr) => [sr.sku_id, sr]));

  let rows = skus.map((s) => {
    const level = levelsMap[s.id] ?? null;
    const rule  = rulesMap[s.id]  ?? null;
    const price = pricesMap[s.id] ?? null;
    return {
      rule_id:               rule?.id ?? null,
      node_id:               node_id ?? rule?.node_id ?? null,
      sku_id:                s.id,
      has_rule:              rule !== null,
      has_stock_level:       level !== null,
      is_active:             rule?.is_active ?? true,
      safety_stock:          N(rule?.safety_stock),
      reorder_point:         N(rule?.reorder_point),
      economic_qty:          N(rule?.economic_qty),
      max_stock:             rule?.max_stock != null ? N(rule.max_stock) : null,
      lead_time_days:        rule?.lead_time_days ?? 1,
      costing_method_id:     rule?.costing_method_id ?? null,
      preferred_supplier_id: rule?.preferred_supplier_id ?? null,
      costing_method:        rule?.costing_method ?? null,
      preferred_supplier:    rule?.preferred_supplier ?? null,
      updated_at:            rule?.updated_at ?? null,
      qty_available:         N(level?.qty_available),
      qty_physical:          N(level?.qty_physical),
      qty_reserved:          N(level?.qty_reserved),
      qty_incoming:          N(level?.qty_incoming),
      price_ttc:             price ? N(price.price) : null,
      sku: {
        id:      s.id,
        images:  s.images,
        article: {
          id:       s.id,
          sku_code: s.sku_code,
          ean13:    s.ean13,
          name_fr:  s.name_fr,
          name_ar:  s.name_ar,
          category: s.category,
          family:   s.sku_family,
          images:   s.images,
        },
      },
    };
  });

  // Boolean filters
  if (is_active !== undefined) {
    const active = is_active === 'true' || is_active === true;
    rows = rows.filter((r) => r.is_active === active);
  }
  if (low_stock === 'true' || low_stock === true)
    rows = rows.filter((r) => r.has_rule && r.qty_available <= r.reorder_point);
  if (critical_stock === 'true' || critical_stock === true)
    rows = rows.filter((r) => r.has_rule && r.qty_available <= r.safety_stock);
  if (overstock === 'true' || overstock === true)
    rows = rows.filter((r) => r.has_rule && r.max_stock !== null && r.qty_available > r.max_stock);

  return rows;
};

const findByNode = (node_id) => findWithFilters({ node_id });

const findById = (id) =>
  prisma.reorderRule.findUnique({
    where: { id },
    include: {
      costing_method:     true,
      preferred_supplier: true,
    },
  });

const findOne = (node_id, sku_id) =>
  prisma.reorderRule.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });

// ─── References ───────────────────────────────────────────────────────────────

const getRefs = async () => {
  const [costing_methods, suppliers] = await Promise.all([
    prisma.costingMethod.findMany({ orderBy: { code: 'asc' } }),
    prisma.supplier.findMany({
      where:   { is_active: true, is_deleted: false },
      orderBy: { name_fr: 'asc' },
      select:  { id: true, code: true, name_fr: true, name_ar: true },
    }),
  ]);
  return { costing_methods, suppliers };
};

// ─── Mutations ────────────────────────────────────────────────────────────────

const create = (data) =>
  prisma.reorderRule.create({
    data,
    include: { costing_method: true, preferred_supplier: true },
  });

const upsert = (node_id, sku_id, data) =>
  prisma.reorderRule.upsert({
    where:  { node_id_sku_id: { node_id, sku_id } },
    update: data,
    create: { node_id, sku_id, ...data },
    include: { costing_method: true, preferred_supplier: true },
  });

const update = (id, data) =>
  prisma.reorderRule.update({
    where: { id },
    data,
    include: { costing_method: true, preferred_supplier: true },
  });

const remove = (id) =>
  prisma.reorderRule.delete({ where: { id } });

const bulkSave = async (rows) => {
  // L'import CSV envoie sku_code plutôt que sku_id — on le résout ici.
  const codes = rows.filter((r) => !r.sku_id && r.sku_code).map((r) => r.sku_code);
  let skuByCode = {};
  if (codes.length) {
    const skus = await prisma.sku.findMany({
      where: { sku_code: { in: codes } },
      select: { id: true, sku_code: true },
    });
    skuByCode = Object.fromEntries(skus.map((s) => [s.sku_code, s.id]));
  }

  const resolved = rows.map(({ node_id, sku_id, sku_code, ...data }) => ({
    node_id,
    sku_id: sku_id || skuByCode[sku_code],
    ...data,
  }));

  const unresolved = resolved.filter((r) => !r.sku_id);
  if (unresolved.length) {
    const err = new Error(`SKU introuvable pour ${unresolved.length} ligne(s)`);
    err.statusCode = 400;
    throw err;
  }

  return prisma.$transaction(
    resolved.map(({ node_id, sku_id, ...data }) =>
      prisma.reorderRule.upsert({
        where:  { node_id_sku_id: { node_id, sku_id } },
        update: data,
        create: { node_id, sku_id, ...data },
      })
    )
  );
};

// ─── Business logic ───────────────────────────────────────────────────────────

const shouldReorder = async (node_id, sku_id) => {
  const [rule, level] = await Promise.all([
    prisma.reorderRule.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } }),
    prisma.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } }),
  ]);

  if (!rule || !level) {
    return { should: false, reason: 'no_data', current_stock: 0, reorder_point: 0, recommended_qty: 0 };
  }

  const qty          = N(level.qty_available);
  const rp           = N(rule.reorder_point);
  const should       = qty <= rp && rule.is_active;
  const maxStock     = rule.max_stock != null ? N(rule.max_stock) : 0;
  const ecoQty       = N(rule.economic_qty);
  const recommended_qty = Math.max(ecoQty, maxStock > 0 ? maxStock - qty : ecoQty);

  return {
    should,
    reason:         should ? (qty <= N(rule.safety_stock) ? 'critical' : 'reorder_needed') : 'ok',
    current_stock:  qty,
    reorder_point:  rp,
    safety_stock:   N(rule.safety_stock),
    economic_qty:   ecoQty,
    recommended_qty,
    lead_time_days: rule.lead_time_days,
    estimated_arrival: (() => {
      const d = new Date();
      d.setDate(d.getDate() + (rule.lead_time_days ?? 1));
      return d;
    })(),
  };
};

const detectCriticalStock = async (node_id, sku_id) => {
  const [rule, level] = await Promise.all([
    prisma.reorderRule.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } }),
    prisma.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } }),
  ]);

  if (!rule || !level) return { critical: false, reason: 'no_data' };

  const qty = N(level.qty_available);
  const ss  = N(rule.safety_stock);
  return { critical: qty <= ss, qty_available: qty, safety_stock: ss };
};

const detectOverstock = async (node_id, sku_id) => {
  const [rule, level] = await Promise.all([
    prisma.reorderRule.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } }),
    prisma.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } }),
  ]);

  if (!rule?.max_stock || !level) return { overstock: false, reason: 'no_data' };

  const qty     = N(level.qty_available);
  const maxStock = N(rule.max_stock);
  return { overstock: qty > maxStock, qty_available: qty, max_stock: maxStock, excess: Math.max(0, qty - maxStock) };
};

const calculateSuggestedReorderQty = async (node_id, sku_id) => {
  const [rule, level] = await Promise.all([
    prisma.reorderRule.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } }),
    prisma.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } }),
  ]);

  if (!rule) return { qty: 0, reason: 'no_rule' };

  const qty      = N(level?.qty_available);
  const maxStock = rule.max_stock != null ? N(rule.max_stock) : 0;
  const ecoQty   = N(rule.economic_qty);
  const suggested = Math.max(ecoQty, maxStock > 0 ? maxStock - qty : ecoQty);

  return { qty: suggested, economic_qty: ecoQty, max_stock: maxStock, current_stock: qty };
};

module.exports = {
  findWithFilters, findByNode, findById, findOne, getRefs,
  create, upsert, update, remove, bulkSave,
  shouldReorder, detectCriticalStock, detectOverstock, calculateSuggestedReorderQty,
};