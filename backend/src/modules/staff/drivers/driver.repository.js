const prisma = require('../../../config/database');

const SELECT = { id: true, node_id: true, phone_country: true, phone_number: true, name: true, vehicle_type: true, vehicle_plate: true, is_active: true, is_deleted: true, deleted_at: true, created_by: true, created_at: true, updated_at: true, node: { select: { id: true, code: true, name_fr: true } }, role_id: true, role: { select: { id: true, code: true, name: true, name_fr: true, name_ar: true } } };

// Codes de statut (insensibles à la casse côté données) : une tournée « in_progress »
// rend le livreur indisponible ; « completed » compte comme tournée terminée.
const TOUR_ACTIVE    = ['in_progress', 'IN_PROGRESS', 'started', 'STARTED'];
const TOUR_PLANNED   = ['planned', 'PLANNED'];
const TOUR_DONE      = ['completed', 'COMPLETED', 'done', 'DONE', 'closed', 'CLOSED'];
const STOP_DELIVERED = ['delivered', 'DELIVERED'];
const STOP_FAILED    = ['failed', 'FAILED'];

const buildWhere = ({ node_id, is_active, vehicle_type, search } = {}) => {
  const w = { is_deleted: false };
  if (node_id)      w.node_id      = node_id;
  if (vehicle_type) w.vehicle_type = vehicle_type;
  if (is_active !== undefined && is_active !== '') w.is_active = is_active === 'true' || is_active === true;
  if (search?.trim()) {
    const s = search.trim();
    w.OR = [{ name: { contains: s, mode: 'insensitive' } }, { phone_number: { contains: s.replace(/^0/, '') } }, { vehicle_plate: { contains: s, mode: 'insensitive' } }];
  }
  return w;
};

const periodWhere = (from, to) => {
  if (!from && !to) return {};
  const f = {};
  if (from) { const d = new Date(from); if (!Number.isNaN(d.getTime())) f.gte = d; }
  if (to)   { const d = new Date(to); if (!Number.isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); f.lte = d; } }
  if (!Object.keys(f).length) return {};
  // Tournée datée par planned_at, à défaut par sa date de création.
  return { OR: [{ planned_at: f }, { planned_at: null, created_at: f }] };
};

/** Tournée en cours / planifiées par livreur → disponibilité (US-018). */
const findAvailability = async (driverIds) => {
  if (!driverIds.length) return {};
  const tours = await prisma.tour.findMany({
    where: { driver_id: { in: driverIds }, status: { code: { in: [...TOUR_ACTIVE, ...TOUR_PLANNED] } } },
    select: { id: true, driver_id: true, planned_at: true, date: true, status: { select: { code: true, name_fr: true } } },
    orderBy: { created_at: 'desc' },
  });
  const out = {};
  for (const t of tours) {
    const a = (out[t.driver_id] ||= { current_tour: null, planned_tours: 0 });
    if (TOUR_ACTIVE.includes(t.status.code)) { if (!a.current_tour) a.current_tour = t; }
    else a.planned_tours += 1;
  }
  return out;
};

const withAvailability = (d, a) => ({
  ...d,
  current_tour:  a?.current_tour ?? null,
  planned_tours: a?.planned_tours ?? 0,
  availability:  !d.is_active ? 'inactive' : (a?.current_tour ? 'on_tour' : 'available'),
});

const findAll = async ({ page = 1, limit = 25, availability, ...filters } = {}) => {
  const where = buildWhere(filters);
  const [data, total] = await Promise.all([
    prisma.driver.findMany({ where, select: SELECT, orderBy: { created_at: 'desc' }, skip: (page-1)*limit, take: limit }),
    prisma.driver.count({ where }),
  ]);
  const av = await findAvailability(data.map((d) => d.id));
  return { data: data.map((d) => withAvailability(d, av[d.id])), total };
};

const findById    = (id) => prisma.driver.findUnique({ where: { id }, select: { ...SELECT, password_hash: true } });
const findByPhone = (phone_country, phone_number) =>
  prisma.driver.findFirst({ where: { phone_country, phone_number, is_deleted: false }, select: { ...SELECT, password_hash: true } });

const create     = (data) => prisma.driver.create({ data, select: SELECT });
const update     = (id, data) => prisma.driver.update({ where: { id }, data, select: SELECT });
const softDelete = (id) => prisma.driver.update({ where: { id }, data: { is_deleted: true, is_active: false, deleted_at: new Date() }, select: SELECT });

// ── Statistiques du livreur (tournées, arrêts, COD) ──────────────────────────
const findStats = async (driver_id, { from, to } = {}) => {
  const tourWhere = { driver_id, ...periodWhere(from, to) };
  const [tours, stops, cod] = await Promise.all([
    prisma.tour.findMany({ where: tourWhere, select: { id: true, status: { select: { code: true } } } }),
    prisma.tourStop.findMany({ where: { tour: tourWhere }, select: { status: { select: { code: true } }, arrived_at: true, delivered_at: true } }),
    prisma.tourStop.aggregate({ where: { tour: tourWhere, cod_collected: true }, _sum: { amount_collected: true } }),
  ]);
  const code = (x) => x.status?.code ?? '';
  const delivered = stops.filter((s) => STOP_DELIVERED.includes(code(s))).length;
  const failed    = stops.filter((s) => STOP_FAILED.includes(code(s))).length;
  const withTimes = stops.filter((s) => s.arrived_at && s.delivered_at);
  return {
    total_tours:       tours.length,
    completed_tours:   tours.filter((t) => TOUR_DONE.includes(code(t))).length,
    in_progress_tours: tours.filter((t) => TOUR_ACTIVE.includes(code(t))).length,
    planned_tours:     tours.filter((t) => TOUR_PLANNED.includes(code(t))).length,
    total_stops:       stops.length,
    total_deliveries:  delivered,
    failed_deliveries: failed,
    success_rate:      delivered + failed > 0 ? Math.round((delivered / (delivered + failed)) * 100) : null,
    cod_collected:     Number(cod._sum.amount_collected ?? 0).toFixed(2),
    avg_stop_duration_min: withTimes.length
      ? Math.round(withTimes.reduce((s, x) => s + (new Date(x.delivered_at) - new Date(x.arrived_at)) / 60000, 0) / withTimes.length)
      : null,
  };
};

// ── Tournées liées (onglet « Tournées liées ») ───────────────────────────────
const findTours = async (driver_id, { page = 1, limit = 20, from, to, status_code } = {}) => {
  const where = { driver_id, ...periodWhere(from, to) };
  if (status_code) where.status = { code: { equals: status_code, mode: 'insensitive' } };
  const [data, total] = await Promise.all([
    prisma.tour.findMany({
      where,
      include: {
        status: { select: { id: true, code: true, name_fr: true } },
        node:   { select: { id: true, code: true, name_fr: true } },
        stops: {
          select: {
            id: true, sort_order: true, order_id: true, arrived_at: true, delivered_at: true,
            failure_reason: true, cod_collected: true, amount_collected: true,
            status: { select: { code: true, name_fr: true } },
            order:  { select: { id: true, total_ttc: true, customer: { select: { name: true } } } },
          },
          orderBy: { sort_order: 'asc' },
        },
        _count: { select: { stops: true } },
      },
      orderBy: [{ planned_at: 'desc' }, { created_at: 'desc' }],
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
    prisma.tour.count({ where }),
  ]);
  const enriched = data.map((t) => {
    const delivered = t.stops.filter((s) => STOP_DELIVERED.includes(s.status?.code ?? '')).length;
    const failed    = t.stops.filter((s) => STOP_FAILED.includes(s.status?.code ?? '')).length;
    return { ...t, stops_delivered: delivered, stops_failed: failed, stops_pending: t.stops.length - delivered - failed };
  });
  return { data: enriched, total };
};

const countOpenTours = (driver_id) =>
  prisma.tour.count({ where: { driver_id, status: { code: { in: [...TOUR_ACTIVE, ...TOUR_PLANNED] } } } });

// Répartition des types de véhicule (livreurs actifs)
const countByVehicleType = async () => {
  const rows = await prisma.driver.groupBy({
    by: ['vehicle_type'],
    where: { is_deleted: false, is_active: true },
    _count: { id: true },
  });
  return rows.map(r => ({ vehicle_type: r.vehicle_type ?? 'Non défini', count: r._count.id }));
};

module.exports = { findAll, findById, findByPhone, create, update, softDelete, findStats, findTours, findAvailability, withAvailability, countOpenTours, countByVehicleType };
