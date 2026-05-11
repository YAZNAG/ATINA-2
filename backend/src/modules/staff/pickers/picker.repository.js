const prisma = require('../../../config/database');

const SELECT = { id: true, node_id: true, phone_country: true, phone_number: true, name: true, is_active: true, is_deleted: true, deleted_at: true, created_by: true, created_at: true, updated_at: true, node: { select: { id: true, code: true, name_fr: true } } };

const buildWhere = ({ node_id, is_active, search } = {}) => {
  const w = { is_deleted: false };
  if (node_id)  w.node_id   = node_id;
  if (is_active !== undefined && is_active !== '') w.is_active = is_active === 'true' || is_active === true;
  if (search?.trim()) w.OR = [{ name: { contains: search, mode: 'insensitive' } }, { phone_number: { contains: search } }];
  return w;
};

const dateFilter = (from, to) => {
  if (!from && !to) return {};
  const f = {};
  if (from) f.gte = new Date(from);
  if (to)   { const d = new Date(to); d.setHours(23,59,59,999); f.lte = d; }
  return { created_at: f };
};

// ── List ──────────────────────────────────────────────────────────────────────
const findAll = async ({ page = 1, limit = 25, ...filters } = {}) => {
  const where = buildWhere(filters);
  const [data, total] = await Promise.all([
    prisma.picker.findMany({ where, select: SELECT, orderBy: { created_at: 'desc' }, skip: (page-1)*limit, take: limit }),
    prisma.picker.count({ where }),
  ]);
  return { data, total };
};

const findById    = (id) => prisma.picker.findUnique({ where: { id }, select: { ...SELECT, password_hash: true } });
const findByPhone = (phone_country, phone_number) =>
  prisma.picker.findFirst({ where: { phone_country, phone_number, is_deleted: false }, select: { ...SELECT, password_hash: true } });

const create     = (data) => prisma.picker.create({ data, select: SELECT });
const update     = (id, data) => prisma.picker.update({ where: { id }, data, select: SELECT });
const softDelete = (id) => prisma.picker.update({ where: { id }, data: { is_deleted: true, is_active: false, deleted_at: new Date() }, select: SELECT });

// ── Stats ─────────────────────────────────────────────────────────────────────
const findStats = async (picker_id, { from, to } = {}) => {
  const df = dateFilter(from, to);
  const sessionWhere = { picker_id, ...df };

  const [allSessions, completedSessions, inProgressSessions, itemsAgg] = await Promise.all([
    prisma.pickingSession.findMany({ where: sessionWhere, select: { id: true, started_at: true, completed_at: true, error_count: true, status: { select: { code: true } } } }),
    prisma.pickingSession.count({ where: { ...sessionWhere, status: { code: 'completed' } } }),
    prisma.pickingSession.count({ where: { ...sessionWhere, status: { code: 'in_progress' } } }),
    prisma.pickingSessionItem.aggregate({
      where: { session: sessionWhere, status: { code: 'picked' } },
      _count: { id: true },
    }),
  ]);

  const totalSessions = allSessions.length;
  const totalErrors   = allSessions.reduce((s, x) => s + (x.error_count ?? 0), 0);
  const totalOrders   = allSessions.length; // 1 session = 1 order
  const totalItemsPicked = itemsAgg._count.id ?? 0;
  const successRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  // Average duration (completed sessions only)
  const durSessions = allSessions.filter(s => s.started_at && s.completed_at);
  const avgDurationMin = durSessions.length > 0
    ? Math.round(durSessions.reduce((sum, s) => sum + (new Date(s.completed_at) - new Date(s.started_at)) / 60000, 0) / durSessions.length)
    : 0;

  // Daily breakdown (last 30 days or date range)
  const days = from ? Math.ceil((new Date(to||Date.now()) - new Date(from)) / 86400000) + 1 : 7;
  const dailyData = Array.from({ length: Math.min(days, 30) }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (Math.min(days,30) - 1 - i));
    const dateStr = d.toISOString().split('T')[0];
    const daySessions = allSessions.filter(s => s.created_at && s.created_at.toISOString().startsWith(dateStr));
    return { date: dateStr, label: d.toLocaleDateString('fr-MA', { weekday: 'short', day:'numeric' }), sessions: daySessions.length, errors: daySessions.reduce((s,x)=>s+(x.error_count??0),0) };
  });

  return { total_sessions: totalSessions, completed_sessions: completedSessions, in_progress_sessions: inProgressSessions, cancelled_sessions: allSessions.filter(s=>s.status?.code==='cancelled').length, total_orders: totalOrders, total_items_picked: totalItemsPicked, total_errors: totalErrors, success_rate: successRate, avg_duration_min: avgDurationMin, daily: dailyData };
};

// ── Sessions ──────────────────────────────────────────────────────────────────
const findSessions = async (picker_id, { page = 1, limit = 25, status_code, from, to } = {}) => {
  const df = dateFilter(from, to);
  const where = { picker_id, ...df };
  if (status_code) where.status = { code: status_code };

  const [data, total] = await Promise.all([
    prisma.pickingSession.findMany({
      where,
      include: {
        order: { select: { id: true, total_ttc: true, customer: { select: { name: true, phone_number: true } } } },
        status: { select: { id: true, code: true, name_fr: true } },
        _count: { select: { items: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: (Number(page)-1)*Number(limit), take: Number(limit),
    }),
    prisma.pickingSession.count({ where }),
  ]);
  return { data, total };
};

// ── Orders ────────────────────────────────────────────────────────────────────
const findOrders = async (picker_id, { page = 1, limit = 25, search, status_code, from, to } = {}) => {
  const df = dateFilter(from, to);
  const sessionWhere = { picker_id, ...df };
  if (status_code) sessionWhere.status = { code: status_code };

  const [sessions, total] = await Promise.all([
    prisma.pickingSession.findMany({
      where: sessionWhere,
      include: {
        status: { select: { code: true, name_fr: true } },
        order: {
          include: {
            customer: { select: { id: true, name: true, phone_country: true, phone_number: true, city: true, wallet_balance: true, points_balance: true } },
            address:  { select: { label: true, street_number: true, street_name: true, quartier: true, city: true, postal_code: true, delivery_notes: true } },
            status:   { select: { code: true, name_fr: true, color: true } },
            delivery_type: { select: { code: true, name_fr: true } },
            confirmed_slot: { select: { name_fr: true, slot_start: true, slot_end: true, day_of_week: true } },
            items: {
              include: {
                sku:    { select: { id: true, article: { select: { name_fr: true, name_ar: true, sku_code: true, ean13: true, price: true } } } },
                status: { select: { code: true, name_fr: true, color: true } },
              },
            },
            payments: {
              select: { amount: true, currency: true, status: { select: { code: true, name_fr: true } }, payment_method: { select: { name_fr: true, code: true } } },
              take: 1,
            },
          },
        },
        items: {
          include: {
            status:     { select: { code: true, name_fr: true } },
            location:   { select: { code: true, aisle: true, shelf: true } },
            order_item: { select: { id: true, qty: true, sku_id: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (Number(page)-1)*Number(limit), take: Number(limit),
    }),
    prisma.pickingSession.count({ where: sessionWhere }),
  ]);

  return { data: sessions, total };
};

module.exports = { findAll, findById, findByPhone, create, update, softDelete, findStats, findSessions, findOrders };
