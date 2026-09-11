/**
 * Distribution Stock — couverture et ruptures (maille Node × SKU).
 *
 * Règles (US-042, US-048, US-096, US-113) :
 *  - qty_available (stock_levels) est la source de vérité de la disponibilité.
 *  - Ventes = stock_moves de type 'sale' avec qty_delta < 0 sur les 30 derniers jours.
 *  - Jours de couverture = qty_available / (ventes 30 j / 30). Aucune vente → NULL (∞).
 *    qty_available ≤ 0 → couverture 0.
 *  - RUPTURE : qty_available ≤ 0.
 *  - ALERTE  : règle de réappro active et qty_available ≤ reorder_point.
 *  - Un couple node × SKU sans règle n'apparaît en alerte que s'il est en rupture.
 *  - Une règle active sans ligne stock_levels est considérée à 0 (rupture).
 * Lecture seule : aucune écriture.
 */
const prisma = require('../../config/database');
const {
  Prisma, num, n0, bad, uuidOrNull, intOrNull, positiveNumberOrNull, pageParams, andSql,
} = require('./reporting.helpers');

const SALES_WINDOW_DAYS = 30;
const DEFAULT_COVERAGE_THRESHOLD = 7;

// ── Filtres ───────────────────────────────────────────────────────────────────
function parseFilters(q = {}) {
  const search = typeof q.search === 'string' ? q.search.trim().slice(0, 100) : '';
  const threshold = positiveNumberOrNull(q.coverage_threshold, 'Le seuil de couverture');
  return {
    node_id: uuidOrNull(q.node_id, 'node'),
    region_id: uuidOrNull(q.region_id, 'région'),
    family_id: uuidOrNull(q.family_id, 'famille'),
    category_id: uuidOrNull(q.category_id, 'catégorie'),
    brand_id: intOrNull(q.brand_id, 'marque'),
    sku_id: uuidOrNull(q.sku_id, 'SKU'),
    search: search || null,
    coverage_threshold: threshold ?? DEFAULT_COVERAGE_THRESHOLD,
  };
}

function filtersOut(f) {
  return {
    node_id: f.node_id, region_id: f.region_id, family_id: f.family_id,
    category_id: f.category_id, brand_id: f.brand_id, search: f.search,
    coverage_threshold: f.coverage_threshold,
  };
}

/**
 * CTE commune : sales → pairs → base (une ligne par couple node × SKU filtré).
 * Colonnes de base : node_*, region_*, sku_*, family/category/brand, qty_*, reorder_point,
 * safety_stock, rule_id, sold_30d, daily_sales, coverage_days, state.
 */
function baseCte(f, extra = {}) {
  const like = f.search ? `%${f.search.replace(/[\\%_]/g, (m) => `\\${m}`)}%` : null;
  const skuIds = extra.sku_ids && extra.sku_ids.length ? extra.sku_ids : null;
  const conds = [
    Prisma.sql`n.is_deleted = false`,
    Prisma.sql`n.is_active = true`,
    f.node_id && Prisma.sql`n.id = ${f.node_id}::uuid`,
    f.region_id && Prisma.sql`n.region_id = ${f.region_id}::uuid`,
    Prisma.sql`k.is_deleted = false`,
    // Un SKU inactif n'est pas surveillé, sauf consultation explicite de son détail.
    f.sku_id ? null : Prisma.sql`k.is_active = true`,
    f.family_id && Prisma.sql`k.sku_family_id = ${f.family_id}::uuid`,
    f.category_id && Prisma.sql`k.category_id = ${f.category_id}::uuid`,
    f.brand_id && Prisma.sql`k.brand_id = ${f.brand_id}::int`,
    f.sku_id && Prisma.sql`k.id = ${f.sku_id}::uuid`,
    skuIds && Prisma.sql`k.id = ANY(${skuIds}::uuid[])`,
    like && Prisma.sql`(k.sku_code ILIKE ${like} OR k.name_fr ILIKE ${like} OR k.name_ar ILIKE ${like} OR COALESCE(k.ean13, '') ILIKE ${like})`,
  ];

  return Prisma.sql`
    WITH sales AS (
      SELECT sm.node_id, sm.sku_id, SUM(-sm.qty_delta) AS sold_30d
      FROM stock_moves sm
      JOIN move_types mt ON mt.id = sm.move_type_id
      WHERE lower(mt.code) = 'sale'
        AND sm.qty_delta < 0
        AND sm.created_at >= now() - (${SALES_WINDOW_DAYS}::int * interval '1 day')
      GROUP BY sm.node_id, sm.sku_id
    ),
    pairs AS (
      SELECT sl.node_id, sl.sku_id, sl.qty_physical, sl.qty_reserved, sl.qty_available, sl.updated_at
      FROM stock_levels sl
      UNION ALL
      SELECT rr.node_id, rr.sku_id, 0::numeric, 0::numeric, 0::numeric, NULL::timestamptz
      FROM reorder_rules rr
      WHERE rr.is_active = true
        AND NOT EXISTS (SELECT 1 FROM stock_levels s2 WHERE s2.node_id = rr.node_id AND s2.sku_id = rr.sku_id)
    ),
    base AS (
      SELECT
        p.node_id, n.code AS node_code, n.name_fr AS node_name, n.name_ar AS node_name_ar,
        n.region_id, r.name_fr AS region_name,
        p.sku_id, k.sku_code, k.name_fr AS sku_name, k.name_ar AS sku_name_ar,
        k.sku_family_id AS family_id, f.name_fr AS family_name,
        k.category_id, c.name_fr AS category_name,
        k.brand_id, b.name_fr AS brand_name,
        p.qty_physical::float8  AS qty_physical,
        p.qty_reserved::float8  AS qty_reserved,
        p.qty_available::float8 AS qty_available,
        p.updated_at            AS level_updated_at,
        rr.id                   AS rule_id,
        rr.reorder_point::float8 AS reorder_point,
        rr.safety_stock::float8  AS safety_stock,
        rr.economic_qty::float8  AS economic_qty,
        COALESCE(s.sold_30d, 0)::float8 AS sold_30d,
        (COALESCE(s.sold_30d, 0) / ${SALES_WINDOW_DAYS}::numeric)::float8 AS daily_sales,
        CASE
          WHEN p.qty_available <= 0 THEN 0::float8
          WHEN COALESCE(s.sold_30d, 0) > 0 THEN (p.qty_available / (s.sold_30d / ${SALES_WINDOW_DAYS}::numeric))::float8
          ELSE NULL
        END AS coverage_days,
        CASE
          WHEN p.qty_available <= 0 THEN 'rupture'
          WHEN rr.id IS NOT NULL AND p.qty_available <= rr.reorder_point THEN 'alert'
          ELSE 'ok'
        END AS state
      FROM pairs p
      JOIN nodes n            ON n.id = p.node_id
      LEFT JOIN regions r     ON r.id = n.region_id
      JOIN skus k             ON k.id = p.sku_id
      LEFT JOIN sku_families f ON f.id = k.sku_family_id
      LEFT JOIN categories c  ON c.id = k.category_id
      LEFT JOIN brands b      ON b.id = k.brand_id
      LEFT JOIN reorder_rules rr ON rr.node_id = p.node_id AND rr.sku_id = p.sku_id AND rr.is_active = true
      LEFT JOIN sales s       ON s.node_id = p.node_id AND s.sku_id = p.sku_id
      WHERE ${andSql(conds)}
    )`;
}

/** Normalise une ligne de la CTE base. */
function mapBaseRow(r) {
  return {
    node_id: r.node_id,
    node_code: r.node_code,
    node_name: r.node_name,
    node_name_ar: r.node_name_ar,
    region_id: r.region_id,
    region_name: r.region_name,
    sku_id: r.sku_id,
    sku_code: r.sku_code,
    sku_name: r.sku_name,
    sku_name_ar: r.sku_name_ar,
    family_name: r.family_name,
    category_name: r.category_name,
    brand_name: r.brand_name,
    qty_physical: n0(r.qty_physical, 3),
    qty_reserved: n0(r.qty_reserved, 3),
    qty_available: n0(r.qty_available, 3),
    reorder_point: num(r.reorder_point, 3),
    safety_stock: num(r.safety_stock, 3),
    economic_qty: num(r.economic_qty, 3),
    has_rule: !!r.rule_id,
    sold_30d: n0(r.sold_30d, 3),
    daily_sales: n0(r.daily_sales, 3),
    coverage_days: num(r.coverage_days, 1),
    state: r.state,
    level_updated_at: r.level_updated_at || null,
  };
}

const coverageSqlAgg = Prisma.sql`
  CASE
    WHEN SUM(GREATEST(qty_available, 0)) <= 0 THEN 0::float8
    WHEN SUM(sold_30d) > 0 THEN (SUM(GREATEST(qty_available, 0)) / (SUM(sold_30d) / ${SALES_WINDOW_DAYS}::float8))::float8
    ELSE NULL
  END`;

// ── Couverture par Node ───────────────────────────────────────────────────────
async function nodeCoverage(q = {}) {
  const f = parseFilters(q);
  const thr = f.coverage_threshold;
  const nodeConds = andSql([
    Prisma.sql`n.is_deleted = false`,
    Prisma.sql`n.is_active = true`,
    f.node_id && Prisma.sql`n.id = ${f.node_id}::uuid`,
    f.region_id && Prisma.sql`n.region_id = ${f.region_id}::uuid`,
  ]);

  const rows = await prisma.$queryRaw`
    ${baseCte(f)},
    agg AS (
      SELECT node_id,
        COUNT(*)::int AS sku_count,
        COUNT(*) FILTER (WHERE qty_available > 0)::int AS skus_available,
        COUNT(*) FILTER (WHERE state = 'rupture')::int AS ruptures,
        COUNT(*) FILTER (WHERE state = 'alert')::int   AS alerts,
        COUNT(*) FILTER (WHERE coverage_days IS NOT NULL AND coverage_days <= ${thr}::float8)::int AS below_threshold,
        SUM(qty_physical)::float8  AS qty_physical,
        SUM(qty_reserved)::float8  AS qty_reserved,
        SUM(qty_available)::float8 AS qty_available,
        SUM(sold_30d)::float8      AS sold_30d,
        ${coverageSqlAgg}          AS coverage_days
      FROM base
      GROUP BY node_id
    )
    SELECT n.id AS node_id, n.code AS node_code, n.name_fr AS node_name, n.name_ar AS node_name_ar,
           r.id AS region_id, r.name_fr AS region_name, agg.*
    FROM nodes n
    LEFT JOIN regions r ON r.id = n.region_id
    LEFT JOIN agg ON agg.node_id = n.id
    WHERE ${nodeConds}
    ORDER BY n.code`;

  const data = rows.map((r) => {
    const skuCount = n0(r.sku_count);
    return {
      node_id: r.node_id,
      node_code: r.node_code,
      node_name: r.node_name,
      node_name_ar: r.node_name_ar,
      region_id: r.region_id,
      region_name: r.region_name,
      sku_count: skuCount,
      skus_available: n0(r.skus_available),
      availability_rate: skuCount ? num((n0(r.skus_available) / skuCount) * 100, 1) : null,
      ruptures: n0(r.ruptures),
      alerts: n0(r.alerts),
      below_threshold: n0(r.below_threshold),
      qty_physical: n0(r.qty_physical, 3),
      qty_reserved: n0(r.qty_reserved, 3),
      qty_available: n0(r.qty_available, 3),
      sold_30d: n0(r.sold_30d, 3),
      daily_sales: num(n0(r.sold_30d) / SALES_WINDOW_DAYS, 3),
      coverage_days: skuCount ? num(r.coverage_days, 1) : null,
    };
  });

  const totals = data.reduce((acc, r) => {
    acc.sku_count += r.sku_count; acc.ruptures += r.ruptures; acc.alerts += r.alerts;
    acc.below_threshold += r.below_threshold; acc.qty_physical += r.qty_physical;
    acc.qty_reserved += r.qty_reserved; acc.qty_available += r.qty_available; acc.sold_30d += r.sold_30d;
    return acc;
  }, { sku_count: 0, ruptures: 0, alerts: 0, below_threshold: 0, qty_physical: 0, qty_reserved: 0, qty_available: 0, sold_30d: 0 });

  return { filters: filtersOut(f), sales_window_days: SALES_WINDOW_DAYS, totals, rows: data };
}

// ── Couverture par SKU ────────────────────────────────────────────────────────
const SKU_SORTS = {
  coverage: Prisma.sql`coverage_days ASC NULLS LAST, sku_code ASC`,
  ruptures: Prisma.sql`ruptures DESC, alerts DESC, coverage_days ASC NULLS LAST, sku_code ASC`,
  sold: Prisma.sql`sold_30d DESC, sku_code ASC`,
  rotation: Prisma.sql`rotation DESC NULLS LAST, sku_code ASC`,
  available: Prisma.sql`qty_available ASC, sku_code ASC`,
  code: Prisma.sql`sku_code ASC`,
};

function skuAggSql(f) {
  return Prisma.sql`
    ${baseCte(f)},
    agg AS (
      SELECT sku_id,
        MIN(sku_code) AS sku_code, MIN(sku_name) AS sku_name, MIN(sku_name_ar) AS sku_name_ar,
        MIN(family_name) AS family_name, MIN(category_name) AS category_name, MIN(brand_name) AS brand_name,
        COUNT(*)::int AS node_count,
        COUNT(*) FILTER (WHERE qty_available > 0)::int AS nodes_available,
        COUNT(*) FILTER (WHERE state = 'rupture')::int AS ruptures,
        COUNT(*) FILTER (WHERE state = 'alert')::int   AS alerts,
        SUM(qty_physical)::float8  AS qty_physical,
        SUM(qty_reserved)::float8  AS qty_reserved,
        SUM(qty_available)::float8 AS qty_available,
        SUM(sold_30d)::float8      AS sold_30d,
        ${coverageSqlAgg}          AS coverage_days,
        CASE WHEN SUM(qty_physical) > 0 THEN (SUM(sold_30d) / SUM(qty_physical))::float8 ELSE NULL END AS rotation
      FROM base
      GROUP BY sku_id
    )`;
}

function mapSkuAgg(r) {
  const nodeCount = n0(r.node_count);
  return {
    sku_id: r.sku_id,
    sku_code: r.sku_code,
    sku_name: r.sku_name,
    sku_name_ar: r.sku_name_ar,
    family_name: r.family_name,
    category_name: r.category_name,
    brand_name: r.brand_name,
    node_count: nodeCount,
    nodes_available: n0(r.nodes_available),
    availability_rate: nodeCount ? num((n0(r.nodes_available) / nodeCount) * 100, 1) : null,
    ruptures: n0(r.ruptures),
    alerts: n0(r.alerts),
    qty_physical: n0(r.qty_physical, 3),
    qty_reserved: n0(r.qty_reserved, 3),
    qty_available: n0(r.qty_available, 3),
    sold_30d: n0(r.sold_30d, 3),
    daily_sales: num(n0(r.sold_30d) / SALES_WINDOW_DAYS, 3),
    coverage_days: num(r.coverage_days, 1),
    rotation: num(r.rotation, 2),
  };
}

async function skuCoverage(q = {}) {
  const f = parseFilters(q);
  const { page, limit, offset } = pageParams(q, 50, 500);
  const sort = SKU_SORTS[q.sort] || SKU_SORTS.coverage;
  const onlyBelow = q.only_below === '1' || q.only_below === 'true';
  const where = onlyBelow
    ? Prisma.sql`coverage_days IS NOT NULL AND coverage_days <= ${f.coverage_threshold}::float8`
    : Prisma.sql`TRUE`;

  const rows = await prisma.$queryRaw`
    ${skuAggSql(f)}
    SELECT agg.*, COUNT(*) OVER()::int AS total_count
    FROM agg
    WHERE ${where}
    ORDER BY ${sort}
    LIMIT ${limit}::int OFFSET ${offset}::int`;

  const total = rows.length ? n0(rows[0].total_count) : 0;
  return {
    data: rows.map(mapSkuAgg),
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    meta: { filters: filtersOut(f), sales_window_days: SALES_WINDOW_DAYS },
  };
}

// ── Ruptures & Alertes ───────────────────────────────────────────────────────
function levelCondition(level) {
  if (level === 'rupture') return Prisma.sql`state = 'rupture'`;
  if (level === 'alert') return Prisma.sql`state = 'alert'`;
  return Prisma.sql`state IN ('rupture', 'alert')`;
}

async function alertCounts(f) {
  const rows = await prisma.$queryRaw`
    ${baseCte(f)}
    SELECT
      COUNT(*)::int AS pairs,
      COUNT(*) FILTER (WHERE state = 'rupture')::int AS ruptures,
      COUNT(*) FILTER (WHERE state = 'alert')::int   AS alerts,
      COUNT(DISTINCT sku_id) FILTER (WHERE state = 'rupture')::int AS rupture_skus,
      COUNT(DISTINCT sku_id) FILTER (WHERE state = 'alert')::int   AS alert_skus,
      COUNT(*) FILTER (WHERE coverage_days IS NOT NULL AND coverage_days <= ${f.coverage_threshold}::float8)::int AS below_threshold
    FROM base`;
  const r = rows[0] || {};
  return {
    pairs: n0(r.pairs),
    ruptures: n0(r.ruptures),
    alerts: n0(r.alerts),
    rupture_skus: n0(r.rupture_skus),
    alert_skus: n0(r.alert_skus),
    below_threshold: n0(r.below_threshold),
  };
}

async function alerts(q = {}) {
  const f = parseFilters(q);
  const { page, limit, offset } = pageParams(q, 50, 1000);
  const level = ['rupture', 'alert'].includes(q.level) ? q.level : 'all';
  const coverageMax = positiveNumberOrNull(q.coverage_max, 'La couverture maximale');
  const where = andSql([
    levelCondition(level),
    coverageMax !== null && Prisma.sql`coverage_days IS NOT NULL AND coverage_days <= ${coverageMax}::float8`,
  ]);

  const [rows, counts] = await Promise.all([
    prisma.$queryRaw`
      ${baseCte(f)}
      SELECT base.*, COUNT(*) OVER()::int AS total_count
      FROM base
      WHERE ${where}
      ORDER BY (state = 'rupture') DESC, coverage_days ASC NULLS LAST, node_code ASC, sku_code ASC
      LIMIT ${limit}::int OFFSET ${offset}::int`,
    alertCounts(f),
  ]);

  const total = rows.length ? n0(rows[0].total_count) : 0;
  return {
    data: rows.map(mapBaseRow),
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    meta: { filters: filtersOut(f), level, coverage_max: coverageMax, counts, sales_window_days: SALES_WINDOW_DAYS },
  };
}

// ── Heatmap Node × SKU ────────────────────────────────────────────────────────
async function matrix(q = {}) {
  const f = parseFilters(q);
  const { page, limit, offset } = pageParams(q, 20, 100);
  const sort = SKU_SORTS[q.sort] || SKU_SORTS.ruptures;

  const skuRows = await prisma.$queryRaw`
    ${skuAggSql(f)}
    SELECT agg.*, COUNT(*) OVER()::int AS total_count
    FROM agg
    ORDER BY ${sort}
    LIMIT ${limit}::int OFFSET ${offset}::int`;
  const total = skuRows.length ? n0(skuRows[0].total_count) : 0;
  const skus = skuRows.map(mapSkuAgg);

  const nodeConds = andSql([
    Prisma.sql`n.is_deleted = false`,
    Prisma.sql`n.is_active = true`,
    f.node_id && Prisma.sql`n.id = ${f.node_id}::uuid`,
    f.region_id && Prisma.sql`n.region_id = ${f.region_id}::uuid`,
  ]);
  const nodes = await prisma.$queryRaw`
    SELECT n.id AS node_id, n.code AS node_code, n.name_fr AS node_name, r.name_fr AS region_name
    FROM nodes n LEFT JOIN regions r ON r.id = n.region_id
    WHERE ${nodeConds}
    ORDER BY n.code`;

  let cells = [];
  if (skus.length) {
    const cellRows = await prisma.$queryRaw`
      ${baseCte(f, { sku_ids: skus.map((s) => s.sku_id) })}
      SELECT * FROM base`;
    cells = cellRows.map(mapBaseRow);
  }

  return {
    nodes,
    skus,
    cells,
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    meta: { filters: filtersOut(f), sales_window_days: SALES_WINDOW_DAYS },
  };
}

// ── Détail SKU × Node (niveaux + mouvements) ─────────────────────────────────
async function detail(q = {}) {
  const f = parseFilters(q);
  if (!f.sku_id) throw bad('Le SKU est obligatoire pour afficher le détail');

  const sku = await prisma.sku.findFirst({
    where: { id: f.sku_id, is_deleted: false },
    select: {
      id: true, sku_code: true, name_fr: true, name_ar: true, ean13: true, is_active: true,
      sku_family: { select: { name_fr: true } },
      category: { select: { name_fr: true } },
      brand: { select: { name_fr: true } },
    },
  });
  if (!sku) throw { statusCode: 404, message: 'SKU introuvable' };

  const detailFilters = { ...f, family_id: null, category_id: null, brand_id: null, search: null };
  const levelRows = await prisma.$queryRaw`
    ${baseCte(detailFilters)}
    SELECT * FROM base ORDER BY node_code`;

  const moveConds = andSql([
    Prisma.sql`sm.sku_id = ${f.sku_id}::uuid`,
    f.node_id && Prisma.sql`sm.node_id = ${f.node_id}::uuid`,
    f.region_id && Prisma.sql`n.region_id = ${f.region_id}::uuid`,
  ]);
  const moves = await prisma.$queryRaw`
    SELECT sm.id, sm.created_at, sm.qty_delta::float8 AS qty_delta, sm.reference, sm.reason,
           mt.code AS move_type_code, mt.name_fr AS move_type_name, mt.color AS move_type_color,
           n.code AS node_code, n.name_fr AS node_name
    FROM stock_moves sm
    LEFT JOIN move_types mt ON mt.id = sm.move_type_id
    JOIN nodes n ON n.id = sm.node_id
    WHERE ${moveConds}
    ORDER BY sm.created_at DESC
    LIMIT 50`;

  return {
    sku: {
      id: sku.id, sku_code: sku.sku_code, name_fr: sku.name_fr, name_ar: sku.name_ar, ean13: sku.ean13,
      is_active: sku.is_active, family_name: sku.sku_family?.name_fr || null,
      category_name: sku.category?.name_fr || null, brand_name: sku.brand?.name_fr || null,
    },
    levels: levelRows.map(mapBaseRow),
    moves: moves.map((m) => ({ ...m, qty_delta: n0(m.qty_delta, 3) })),
    meta: { sales_window_days: SALES_WINDOW_DAYS, coverage_threshold: f.coverage_threshold },
  };
}

module.exports = {
  SALES_WINDOW_DAYS,
  DEFAULT_COVERAGE_THRESHOLD,
  parseFilters,
  alertCounts,
  nodeCoverage,
  skuCoverage,
  alerts,
  matrix,
  detail,
};
