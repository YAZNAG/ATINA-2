/**
 * Reporting service — KPI dashboard for Dark Store operations.
 * All queries are date-range aware. Default: last 30 days.
 */
const { Prisma } = require('@prisma/client');
const prisma = require('../../config/database');
const { uuidOrNull } = require('./reporting.helpers');
const distribution = require('./distribution.service');

/** Filtre de périmètre Prisma (node et/ou région du node). */
function scopeWhere({ node_id, region_id } = {}) {
  const nodeId = uuidOrNull(node_id, 'node');
  const regionId = uuidOrNull(region_id, 'région');
  return {
    ...(nodeId ? { node_id: nodeId } : {}),
    ...(regionId ? { node: { region_id: regionId } } : {}),
  };
}

function dateRange(from, to) {
  const now   = new Date();
  const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  const end   = to   ? new Date(to)   : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw { statusCode: 400, message: 'Format de date invalide (AAAA-MM-JJ attendu)' };
  }
  return { gte: start, lte: end };
}

// ── Order KPIs ────────────────────────────────────────────────────────────────
async function orderKpis({ from, to, node_id, region_id } = {}) {
  const range = dateRange(from, to);
  const where = { is_deleted: false, created_at: range, ...scopeWhere({ node_id, region_id }) };

  const [total, byStatus, totals] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.groupBy({
      by: ['status_id'],
      where,
      _count: { id: true },
    }),
    prisma.order.aggregate({
      where,
      _sum: { total_ttc: true, wallet_used: true, delivery_fee: true },
      _avg: { total_ttc: true },
    }),
  ]);

  // Enrich with status codes
  const statusIds = byStatus.map(s => s.status_id);
  const statuses = statusIds.length
    ? await prisma.orderStatus.findMany({ where: { id: { in: statusIds } }, select: { id: true, code: true, name_fr: true, color: true } })
    : [];
  const statusMap = Object.fromEntries(statuses.map(s => [s.id, s]));

  return {
    total_orders:      total,
    total_revenue:     Number(totals._sum.total_ttc ?? 0).toFixed(2),
    avg_order_value:   Number(totals._avg.total_ttc ?? 0).toFixed(2),
    total_wallet_used: Number(totals._sum.wallet_used ?? 0).toFixed(2),
    total_delivery_fee:Number(totals._sum.delivery_fee ?? 0).toFixed(2),
    by_status: byStatus.map(s => ({
      ...statusMap[s.status_id],
      count: s._count.id,
    })),
    period: { from: range.gte, to: range.lte },
  };
}

// ── Picking KPIs ──────────────────────────────────────────────────────────────
async function pickingKpis({ from, to, node_id, region_id } = {}) {
  const range = dateRange(from, to);
  const scope = scopeWhere({ node_id, region_id });
  const where = { created_at: range, ...scope };

  const [total, completed, errors] = await Promise.all([
    prisma.pickingSession.count({ where }),
    prisma.pickingSession.count({ where: { ...where, status: { code: 'completed' } } }),
    prisma.pickingSession.aggregate({ where, _sum: { error_count: true } }),
  ]);

  // Correctif : l'ancien fragment conditionnel imbriquait un $queryRaw (promesse) au lieu d'un Prisma.sql.
  const avgDuration = await prisma.$queryRaw`
    SELECT AVG(EXTRACT(EPOCH FROM (ps.completed_at - ps.started_at))/60)::float8 AS avg_minutes
    FROM picking_sessions ps
    JOIN nodes n ON n.id = ps.node_id
    WHERE ps.completed_at IS NOT NULL
      AND ps.started_at IS NOT NULL
      AND ps.created_at >= ${range.gte.toISOString()}::timestamptz
      AND ps.created_at <= ${range.lte.toISOString()}::timestamptz
      ${scope.node_id ? Prisma.sql`AND ps.node_id = ${scope.node_id}::uuid` : Prisma.empty}
      ${scope.node ? Prisma.sql`AND n.region_id = ${scope.node.region_id}::uuid` : Prisma.empty}
  `;

  return {
    total_sessions:    total,
    completed_sessions: completed,
    completion_rate:   total > 0 ? ((completed / total) * 100).toFixed(1) + '%' : '0%',
    total_errors:      Number(errors._sum.error_count ?? 0),
    avg_duration_min:  avgDuration[0]?.avg_minutes ? Number(avgDuration[0].avg_minutes).toFixed(1) : null,
    period: { from: range.gte, to: range.lte },
  };
}

// ── Delivery KPIs ─────────────────────────────────────────────────────────────
async function deliveryKpis({ from, to, node_id, region_id } = {}) {
  const range = dateRange(from, to);
  const tourWhere = { created_at: range, ...scopeWhere({ node_id, region_id }) };

  const [totalTours, completedTours, totalStops, deliveredStops, failedStops] = await Promise.all([
    prisma.tour.count({ where: tourWhere }),
    prisma.tour.count({ where: { ...tourWhere, status: { code: 'completed' } } }),
    prisma.tourStop.count({ where: { tour: tourWhere } }),
    prisma.tourStop.count({ where: { tour: tourWhere, status: { code: 'delivered' } } }),
    prisma.tourStop.count({ where: { tour: tourWhere, status: { code: 'failed' } } }),
  ]);

  return {
    total_tours:      totalTours,
    completed_tours:  completedTours,
    total_stops:      totalStops,
    delivered_stops:  deliveredStops,
    failed_stops:     failedStops,
    delivery_rate:    totalStops > 0 ? ((deliveredStops / totalStops) * 100).toFixed(1) + '%' : '0%',
    period: { from: range.gte, to: range.lte },
  };
}

// ── Stock KPIs ────────────────────────────────────────────────────────────────
async function stockKpis({ node_id, region_id } = {}) {
  const where = scopeWhere({ node_id, region_id });

  const [levels, lowStock, alertCounts] = await Promise.all([
    prisma.stockLevel.aggregate({
      where,
      _sum: { qty_physical: true, qty_reserved: true, qty_available: true },
      _count: { id: true },
    }),
    prisma.stockLevel.count({ where: { ...where, qty_available: { lte: 5 } } }),
    // Ruptures (≤ 0) et alertes (≤ reorder_point) selon US-113.
    distribution.alertCounts(distribution.parseFilters({ node_id, region_id })),
  ]);

  return {
    total_skus:         levels._count.id,
    total_qty_physical: Number(levels._sum.qty_physical  ?? 0),
    total_qty_reserved: Number(levels._sum.qty_reserved  ?? 0),
    total_qty_available:Number(levels._sum.qty_available ?? 0),
    low_stock_skus:     lowStock,
    rupture_pairs:      alertCounts.ruptures,
    rupture_skus:       alertCounts.rupture_skus,
    alert_pairs:        alertCounts.alerts,
  };
}

// ── Payment KPIs ──────────────────────────────────────────────────────────────
async function paymentKpis({ from, to, node_id, region_id } = {}) {
  const range = dateRange(from, to);
  const scope = scopeWhere({ node_id, region_id });
  const where = { created_at: range, ...(Object.keys(scope).length ? { order: scope } : {}) };

  const [byMethod, byStatus] = await Promise.all([
    prisma.payment.groupBy({
      by: ['payment_method_id'],
      where,
      _count: { id: true },
      _sum:   { amount: true },
    }),
    prisma.payment.groupBy({
      by: ['status_id'],
      where,
      _count: { id: true },
      _sum:   { amount: true },
    }),
  ]);

  const [methodIds, statusIds] = [
    byMethod.map(m => m.payment_method_id).filter(Boolean),
    byStatus.map(s => s.status_id).filter(Boolean),
  ];

  const [methods, statuses] = await Promise.all([
    methodIds.length ? prisma.paymentMethod.findMany({ where: { id: { in: methodIds } }, select: { id: true, code: true, name_fr: true } }) : [],
    statusIds.length ? prisma.paymentStatus.findMany({ where: { id: { in: statusIds } }, select: { id: true, code: true, name_fr: true } }) : [],
  ]);

  const methodMap = Object.fromEntries(methods.map(m => [m.id, m]));
  const statusMap = Object.fromEntries(statuses.map(s => [s.id, s]));

  return {
    by_method: byMethod.map(m => ({
      ...methodMap[m.payment_method_id],
      count:   m._count.id,
      revenue: Number(m._sum.amount ?? 0).toFixed(2),
    })),
    by_status: byStatus.map(s => ({
      ...statusMap[s.status_id],
      count:   s._count.id,
      amount:  Number(s._sum.amount ?? 0).toFixed(2),
    })),
    period: { from: range.gte, to: range.lte },
  };
}

// ── Dashboard summary ─────────────────────────────────────────────────────────
async function dashboardSummary({ from, to, node_id, region_id } = {}) {
  const [orders, picking, delivery, stock, payments] = await Promise.all([
    orderKpis({ from, to, node_id, region_id }),
    pickingKpis({ from, to, node_id, region_id }),
    deliveryKpis({ from, to, node_id, region_id }),
    stockKpis({ node_id, region_id }),
    paymentKpis({ from, to, node_id, region_id }),
  ]);
  return { orders, picking, delivery, stock, payments };
}

module.exports = { orderKpis, pickingKpis, deliveryKpis, stockKpis, paymentKpis, dashboardSummary };
