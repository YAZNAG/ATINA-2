/**
 * KPI Overview — écran d'accueil du back-office (US-092, lecture seule).
 *
 * Onglets : Vue Globale | Commandes | Stock & Rupture | Préparation.
 * Filtres : période (day | week | month ou from/to), node_id, region_id, status (code statut commande).
 *
 * Définitions :
 *  - CA (TTC)            : somme total_ttc des commandes hors annulées / retournées.
 *  - Panier moyen        : CA / nb commandes hors annulées / retournées.
 *  - CA COD encaissé     : somme cod_amount des commandes dont cod_collected_at est renseigné.
 *  - CA COD à encaisser  : somme cod_amount des commandes COD non encaissées, hors annulées / retournées.
 *  - Taux d'annulation   : commandes annulées / commandes de la période.
 *  - Taux de préparation : sessions de picking terminées / sessions non annulées de la période.
 *  - Session en retard   : session ouverte ou en cours depuis plus de `picking_late_minutes`
 *                          (app_configs, défaut 30 min) ou dont le créneau de livraison a commencé.
 */
const prisma = require('../../config/database');
const {
  Prisma, TZ, num, n0, resolveRange, scopeFilters, statusCodeOrNull, andSql, periodOut,
} = require('./reporting.helpers');
const distribution = require('./distribution.service');

const DEFAULT_LATE_MINUTES = 30;

// ── Filtres ───────────────────────────────────────────────────────────────────
async function parseOverviewFilters(q = {}) {
  const range = await resolveRange(q);
  return { range, ...scopeFilters(q), status: statusCodeOrNull(q.status) };
}

function filtersOut(f) {
  return { node_id: f.node_id, region_id: f.region_id, status: f.status || null };
}

const ORDER_FROM = Prisma.sql`
  orders o
  JOIN nodes n           ON n.id = o.node_id
  JOIN order_statuses os ON os.id = o.status_id`;

function orderWhere(f, { withStatus = true } = {}) {
  return andSql([
    Prisma.sql`o.is_deleted = false`,
    Prisma.sql`o.created_at >= ${f.range.start.toISOString()}::timestamptz`,
    Prisma.sql`o.created_at <  ${f.range.end.toISOString()}::timestamptz`,
    f.node_id && Prisma.sql`o.node_id = ${f.node_id}::uuid`,
    f.region_id && Prisma.sql`n.region_id = ${f.region_id}::uuid`,
    withStatus && f.status && Prisma.sql`lower(os.code) = ${f.status}`,
  ]);
}

const notExcluded = Prisma.sql`lower(os.code) NOT IN ('cancelled', 'returned')`;

// ── Commandes ─────────────────────────────────────────────────────────────────
async function orderSummary(f) {
  const rows = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int                                                         AS total_orders,
      COUNT(*) FILTER (WHERE lower(os.code) = 'cancelled')::int             AS cancelled,
      COUNT(*) FILTER (WHERE lower(os.code) = 'delivered')::int             AS delivered,
      COUNT(*) FILTER (WHERE ${notExcluded})::int                           AS valid_orders,
      COALESCE(SUM(o.total_ttc) FILTER (WHERE ${notExcluded}), 0)::float8   AS revenue_ttc,
      COALESCE(SUM(o.discount_amount) FILTER (WHERE ${notExcluded}), 0)::float8 AS discount_total,
      COALESCE(SUM(o.delivery_fee) FILTER (WHERE ${notExcluded}), 0)::float8    AS delivery_fee_total,
      COALESCE(SUM(o.cod_amount) FILTER (WHERE o.cod_amount > 0 AND o.cod_collected_at IS NOT NULL), 0)::float8 AS cod_collected,
      COUNT(*) FILTER (WHERE o.cod_amount > 0 AND o.cod_collected_at IS NOT NULL)::int                         AS cod_collected_orders,
      COALESCE(SUM(o.cod_amount) FILTER (WHERE o.cod_amount > 0 AND o.cod_collected_at IS NULL AND ${notExcluded}), 0)::float8 AS cod_pending,
      COUNT(*) FILTER (WHERE o.cod_amount > 0 AND o.cod_collected_at IS NULL AND ${notExcluded})::int           AS cod_pending_orders
    FROM ${ORDER_FROM}
    WHERE ${orderWhere(f)}`;
  const r = rows[0] || {};
  const total = n0(r.total_orders);
  const valid = n0(r.valid_orders);
  const revenue = n0(r.revenue_ttc, 2);
  return {
    total_orders: total,
    valid_orders: valid,
    delivered: n0(r.delivered),
    cancelled: n0(r.cancelled),
    cancel_rate: total ? num((n0(r.cancelled) / total) * 100, 1) : null,
    revenue_ttc: revenue,
    avg_basket: valid ? num(revenue / valid, 2) : null,
    discount_total: n0(r.discount_total, 2),
    delivery_fee_total: n0(r.delivery_fee_total, 2),
    cod_collected: n0(r.cod_collected, 2),
    cod_collected_orders: n0(r.cod_collected_orders),
    cod_pending: n0(r.cod_pending, 2),
    cod_pending_orders: n0(r.cod_pending_orders),
  };
}

async function ordersByStatus(f) {
  // Répartition sur tous les statuts (le filtre statut ne s'applique pas ici pour garder la vue complète).
  const rows = await prisma.$queryRaw`
    SELECT os.code, os.name_fr, os.name_ar, os.color, os.sort_order,
           COUNT(o.id)::int AS count,
           COALESCE(SUM(o.total_ttc), 0)::float8 AS amount
    FROM order_statuses os
    LEFT JOIN (
      SELECT o.id, o.status_id, o.total_ttc
      FROM ${ORDER_FROM}
      WHERE ${orderWhere(f, { withStatus: false })}
    ) o ON o.status_id = os.id
    GROUP BY os.id, os.code, os.name_fr, os.name_ar, os.color, os.sort_order
    ORDER BY os.sort_order, os.code`;
  const total = rows.reduce((s, r) => s + n0(r.count), 0);
  return rows.map((r) => ({
    code: r.code,
    name_fr: r.name_fr,
    name_ar: r.name_ar,
    color: r.color,
    count: n0(r.count),
    amount: n0(r.amount, 2),
    share: total ? num((n0(r.count) / total) * 100, 1) : 0,
  }));
}

const BUCKET_FORMAT = { hour: 'HH24"h"', day: 'DD/MM', week: '"S"IW DD/MM' };

async function ordersTrend(f) {
  const gran = f.range.granularity;
  const step = `1 ${gran}`;
  const fmt = BUCKET_FORMAT[gran];
  const rows = await prisma.$queryRaw`
    WITH buckets AS (
      SELECT generate_series(
        date_trunc(${gran}, ${f.range.start.toISOString()}::timestamptz AT TIME ZONE ${TZ}),
        date_trunc(${gran}, (${f.range.end.toISOString()}::timestamptz - interval '1 second') AT TIME ZONE ${TZ}),
        ${step}::interval
      ) AS b
    ),
    agg AS (
      SELECT date_trunc(${gran}, o.created_at AT TIME ZONE ${TZ}) AS b,
             COUNT(*)::int AS orders,
             COUNT(*) FILTER (WHERE lower(os.code) = 'cancelled')::int AS cancelled,
             COALESCE(SUM(o.total_ttc) FILTER (WHERE ${notExcluded}), 0)::float8 AS revenue
      FROM ${ORDER_FROM}
      WHERE ${orderWhere(f)}
      GROUP BY 1
    )
    SELECT to_char(buckets.b, ${fmt}) AS label,
           to_char(buckets.b, 'YYYY-MM-DD"T"HH24:MI') AS bucket,
           COALESCE(agg.orders, 0)::int AS orders,
           COALESCE(agg.cancelled, 0)::int AS cancelled,
           COALESCE(agg.revenue, 0)::float8 AS revenue
    FROM buckets
    LEFT JOIN agg ON agg.b = buckets.b
    ORDER BY buckets.b`;
  return {
    granularity: gran,
    points: rows.map((r) => ({
      label: r.label, bucket: r.bucket, orders: n0(r.orders), cancelled: n0(r.cancelled), revenue: n0(r.revenue, 2),
    })),
  };
}

async function ordersByNode(f) {
  const rows = await prisma.$queryRaw`
    SELECT n.id AS node_id, n.code AS node_code, n.name_fr AS node_name,
           COUNT(*)::int AS orders,
           COUNT(*) FILTER (WHERE lower(os.code) = 'cancelled')::int AS cancelled,
           COUNT(*) FILTER (WHERE ${notExcluded})::int AS valid_orders,
           COALESCE(SUM(o.total_ttc) FILTER (WHERE ${notExcluded}), 0)::float8 AS revenue,
           COALESCE(SUM(o.cod_amount) FILTER (WHERE o.cod_amount > 0 AND o.cod_collected_at IS NOT NULL), 0)::float8 AS cod_collected,
           COALESCE(SUM(o.cod_amount) FILTER (WHERE o.cod_amount > 0 AND o.cod_collected_at IS NULL AND ${notExcluded}), 0)::float8 AS cod_pending
    FROM ${ORDER_FROM}
    WHERE ${orderWhere(f)}
    GROUP BY n.id, n.code, n.name_fr
    ORDER BY orders DESC, n.code`;
  return rows.map((r) => {
    const valid = n0(r.valid_orders);
    const orders = n0(r.orders);
    return {
      node_id: r.node_id,
      node_code: r.node_code,
      node_name: r.node_name,
      orders,
      cancelled: n0(r.cancelled),
      cancel_rate: orders ? num((n0(r.cancelled) / orders) * 100, 1) : null,
      revenue: n0(r.revenue, 2),
      avg_basket: valid ? num(n0(r.revenue) / valid, 2) : null,
      cod_collected: n0(r.cod_collected, 2),
      cod_pending: n0(r.cod_pending, 2),
    };
  });
}

// ── Préparation (picking) ─────────────────────────────────────────────────────
async function lateMinutes() {
  try {
    const cfg = await prisma.appConfig.findFirst({
      where: { config_key: 'picking_late_minutes', node_id: null },
      select: { config_value: true },
    });
    const v = Number(cfg?.config_value);
    return Number.isFinite(v) && v > 0 ? v : DEFAULT_LATE_MINUTES;
  } catch {
    return DEFAULT_LATE_MINUTES;
  }
}

function sessionScope(f) {
  return [
    f.node_id && Prisma.sql`ps.node_id = ${f.node_id}::uuid`,
    f.region_id && Prisma.sql`n.region_id = ${f.region_id}::uuid`,
  ];
}

function lateCondition(late) {
  return Prisma.sql`(
    (lower(pst.code) = 'in_progress' AND COALESCE(ps.started_at, ps.created_at) < now() - (${late}::float8 * interval '1 minute'))
    OR (lower(pst.code) = 'open' AND ps.created_at < now() - (${late}::float8 * interval '1 minute'))
    OR (o.slot_start IS NOT NULL AND o.slot_start < now())
  )`;
}

async function pickingSummary(f, late) {
  const periodWhere = andSql([
    Prisma.sql`ps.created_at >= ${f.range.start.toISOString()}::timestamptz`,
    Prisma.sql`ps.created_at <  ${f.range.end.toISOString()}::timestamptz`,
    ...sessionScope(f),
  ]);
  const activeWhere = andSql([Prisma.sql`lower(pst.code) IN ('open', 'in_progress')`, ...sessionScope(f)]);

  const [periodRows, activeRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE lower(pst.code) = 'completed')::int   AS completed,
        COUNT(*) FILTER (WHERE lower(pst.code) = 'cancelled')::int   AS cancelled,
        COUNT(*) FILTER (WHERE lower(pst.code) = 'in_progress')::int AS in_progress,
        COUNT(*) FILTER (WHERE lower(pst.code) = 'open')::int        AS open,
        COALESCE(SUM(ps.error_count), 0)::int AS errors,
        (AVG(EXTRACT(EPOCH FROM (ps.completed_at - ps.started_at)) / 60)
           FILTER (WHERE ps.completed_at IS NOT NULL AND ps.started_at IS NOT NULL))::float8 AS avg_minutes
      FROM picking_sessions ps
      JOIN picking_statuses pst ON pst.id = ps.status_id
      JOIN nodes n ON n.id = ps.node_id
      WHERE ${periodWhere}`,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS active,
             COUNT(*) FILTER (WHERE ${lateCondition(late)})::int AS late
      FROM picking_sessions ps
      JOIN picking_statuses pst ON pst.id = ps.status_id
      JOIN nodes n ON n.id = ps.node_id
      JOIN orders o ON o.id = ps.order_id
      WHERE ${activeWhere}`,
  ]);
  const p = periodRows[0] || {};
  const a = activeRows[0] || {};
  const total = n0(p.total);
  const cancelled = n0(p.cancelled);
  const base = total - cancelled;
  return {
    total_sessions: total,
    completed_sessions: n0(p.completed),
    cancelled_sessions: cancelled,
    in_progress_sessions: n0(p.in_progress),
    open_sessions: n0(p.open),
    preparation_rate: base > 0 ? num((n0(p.completed) / base) * 100, 1) : null,
    total_errors: n0(p.errors),
    avg_duration_min: num(p.avg_minutes, 1),
    active_sessions: n0(a.active),
    late_sessions: n0(a.late),
    late_threshold_minutes: late,
  };
}

async function activeSessions(f, late, limit = 100) {
  const where = andSql([Prisma.sql`lower(pst.code) IN ('open', 'in_progress')`, ...sessionScope(f)]);
  const rows = await prisma.$queryRaw`
    SELECT ps.id, ps.order_id, ps.started_at, ps.created_at, ps.error_count,
           pst.code AS status_code, pst.name_fr AS status_name,
           n.id AS node_id, n.code AS node_code, n.name_fr AS node_name,
           pk.name AS picker_name,
           o.slot_start, o.slot_end,
           (EXTRACT(EPOCH FROM (now() - COALESCE(ps.started_at, ps.created_at))) / 60)::float8 AS elapsed_minutes,
           ${lateCondition(late)} AS is_late,
           (SELECT COUNT(*) FROM picking_session_items i WHERE i.session_id = ps.id)::int AS items_total,
           (SELECT COUNT(*) FROM picking_session_items i
              JOIN pick_item_statuses s ON s.id = i.status_id
             WHERE i.session_id = ps.id AND lower(s.code) <> 'pending')::int AS items_done
    FROM picking_sessions ps
    JOIN picking_statuses pst ON pst.id = ps.status_id
    JOIN nodes n ON n.id = ps.node_id
    JOIN orders o ON o.id = ps.order_id
    LEFT JOIN pickers pk ON pk.id = ps.picker_id
    WHERE ${where}
    ORDER BY is_late DESC, COALESCE(ps.started_at, ps.created_at) ASC
    LIMIT ${limit}::int`;
  return rows.map((r) => ({
    id: r.id,
    order_id: r.order_id,
    order_ref: r.order_id ? String(r.order_id).slice(0, 8).toUpperCase() : null,
    status_code: r.status_code,
    status_name: r.status_name,
    node_id: r.node_id,
    node_code: r.node_code,
    node_name: r.node_name,
    picker_name: r.picker_name,
    started_at: r.started_at,
    created_at: r.created_at,
    slot_start: r.slot_start,
    slot_end: r.slot_end,
    elapsed_minutes: num(r.elapsed_minutes, 0),
    is_late: !!r.is_late,
    items_total: n0(r.items_total),
    items_done: n0(r.items_done),
    error_count: n0(r.error_count),
  }));
}

async function pickingByNode(f) {
  const where = andSql([
    Prisma.sql`ps.created_at >= ${f.range.start.toISOString()}::timestamptz`,
    Prisma.sql`ps.created_at <  ${f.range.end.toISOString()}::timestamptz`,
    ...sessionScope(f),
  ]);
  const rows = await prisma.$queryRaw`
    SELECT n.id AS node_id, n.code AS node_code, n.name_fr AS node_name,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE lower(pst.code) = 'completed')::int AS completed,
           COUNT(*) FILTER (WHERE lower(pst.code) = 'cancelled')::int AS cancelled,
           COUNT(*) FILTER (WHERE lower(pst.code) IN ('open', 'in_progress'))::int AS active,
           COALESCE(SUM(ps.error_count), 0)::int AS errors,
           (AVG(EXTRACT(EPOCH FROM (ps.completed_at - ps.started_at)) / 60)
              FILTER (WHERE ps.completed_at IS NOT NULL AND ps.started_at IS NOT NULL))::float8 AS avg_minutes
    FROM picking_sessions ps
    JOIN picking_statuses pst ON pst.id = ps.status_id
    JOIN nodes n ON n.id = ps.node_id
    WHERE ${where}
    GROUP BY n.id, n.code, n.name_fr
    ORDER BY total DESC, n.code`;
  return rows.map((r) => {
    const base = n0(r.total) - n0(r.cancelled);
    return {
      node_id: r.node_id,
      node_code: r.node_code,
      node_name: r.node_name,
      total: n0(r.total),
      completed: n0(r.completed),
      cancelled: n0(r.cancelled),
      active: n0(r.active),
      errors: n0(r.errors),
      preparation_rate: base > 0 ? num((n0(r.completed) / base) * 100, 1) : null,
      avg_duration_min: num(r.avg_minutes, 1),
    };
  });
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

/** Vue Globale : cartes KPI + répartition statut + tendance. */
async function overview(q = {}) {
  const f = await parseOverviewFilters(q);
  const late = await lateMinutes();
  const stockFilters = distribution.parseFilters({ node_id: f.node_id, region_id: f.region_id });
  const [orders, byStatus, trend, picking, stock] = await Promise.all([
    orderSummary(f),
    ordersByStatus(f),
    ordersTrend(f),
    pickingSummary(f, late),
    distribution.alertCounts(stockFilters),
  ]);
  return {
    period: periodOut(f.range),
    filters: filtersOut(f),
    kpis: {
      total_orders: orders.total_orders,
      revenue_ttc: orders.revenue_ttc,
      avg_basket: orders.avg_basket,
      cod_collected: orders.cod_collected,
      cod_collected_orders: orders.cod_collected_orders,
      cod_pending: orders.cod_pending,
      cod_pending_orders: orders.cod_pending_orders,
      cancelled: orders.cancelled,
      cancel_rate: orders.cancel_rate,
      preparation_rate: picking.preparation_rate,
      completed_sessions: picking.completed_sessions,
      total_sessions: picking.total_sessions,
      active_sessions: picking.active_sessions,
      late_sessions: picking.late_sessions,
      late_threshold_minutes: picking.late_threshold_minutes,
      stock_ruptures: stock.ruptures,
      stock_rupture_skus: stock.rupture_skus,
      stock_alerts: stock.alerts,
      stock_below_coverage: stock.below_threshold,
      coverage_threshold: stockFilters.coverage_threshold,
    },
    by_status: byStatus,
    trend,
  };
}

/** Onglet Commandes. */
async function ordersTab(q = {}) {
  const f = await parseOverviewFilters(q);
  const [summary, byStatus, trend, byNode] = await Promise.all([
    orderSummary(f), ordersByStatus(f), ordersTrend(f), ordersByNode(f),
  ]);
  return { period: periodOut(f.range), filters: filtersOut(f), summary, by_status: byStatus, trend, by_node: byNode };
}

/** Onglet Stock & Rupture (maille node × SKU) — délègue à la distribution stock. */
async function stockTab(q = {}) {
  const res = await distribution.alerts({
    node_id: q.node_id,
    region_id: q.region_id,
    level: q.level,
    coverage_threshold: q.coverage_threshold,
    coverage_max: q.coverage_max,
    search: q.search,
    page: q.page,
    limit: q.limit || 100,
  });
  return res;
}

/** Onglet Préparation. */
async function preparationTab(q = {}) {
  const f = await parseOverviewFilters(q);
  const late = await lateMinutes();
  const [summary, sessions, byNode] = await Promise.all([
    pickingSummary(f, late), activeSessions(f, late), pickingByNode(f),
  ]);
  return { period: periodOut(f.range), filters: filtersOut(f), summary, active_sessions: sessions, by_node: byNode };
}

/** Listes de référence pour les filtres des écrans de reporting. */
async function filterOptions() {
  const [nodes, regions, families, categories, brands, statuses] = await Promise.all([
    prisma.node.findMany({
      where: { is_deleted: false },
      select: { id: true, code: true, name_fr: true, name_ar: true, region_id: true, is_active: true },
      orderBy: { code: 'asc' },
    }),
    prisma.region.findMany({
      where: { is_deleted: false },
      select: { id: true, code: true, name_fr: true, name_ar: true },
      orderBy: { name_fr: 'asc' },
    }),
    prisma.skuFamily.findMany({
      where: { is_deleted: false },
      select: { id: true, code: true, name_fr: true, name_ar: true },
      orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }],
    }),
    prisma.category.findMany({
      where: { is_deleted: false },
      select: { id: true, code: true, name_fr: true, name_ar: true },
      orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }],
    }),
    prisma.brand.findMany({
      where: { deleted_at: null },
      select: { id: true, code: true, name_fr: true, name_ar: true },
      orderBy: { name_fr: 'asc' },
    }),
    prisma.orderStatus.findMany({
      select: { id: true, code: true, name_fr: true, name_ar: true, color: true },
      orderBy: { sort_order: 'asc' },
    }),
  ]);
  return { nodes, regions, families, categories, brands, order_statuses: statuses };
}

module.exports = {
  overview,
  ordersTab,
  stockTab,
  preparationTab,
  filterOptions,
  parseOverviewFilters,
  orderSummary,
  pickingSummary,
  lateMinutes,
};
