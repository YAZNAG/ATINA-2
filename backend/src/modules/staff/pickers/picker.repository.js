const prisma = require('../../../config/database');
const pickingRepo = require('../../picking/picking.repository');

const SELECT = {
  id: true, node_id: true, phone_country: true, phone_number: true, email: true, avatar_url: true, name: true,
  is_active: true, is_deleted: true, deleted_at: true, created_by: true, created_at: true, updated_at: true,
  node: { select: { id: true, code: true, name_fr: true } },
  role_id: true,
  role: { select: { id: true, code: true, name: true, name_fr: true, name_ar: true } },
};

const buildWhere = ({ node_id, is_active, search } = {}) => {
  const w = { is_deleted: false };
  if (node_id)  w.node_id   = node_id;
  if (is_active !== undefined && is_active !== '') w.is_active = is_active === 'true' || is_active === true;
  if (search?.trim()) {
    const s = search.trim();
    w.OR = [
      { name: { contains: s, mode: 'insensitive' } },
      { phone_number: { contains: s.replace(/^0/, '') } },
      { email: { contains: s, mode: 'insensitive' } },
    ];
  }
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
  // Sessions en cours par picker (supervision de la charge)
  const ids = data.map((p) => p.id);
  const active = ids.length
    ? await prisma.pickingSession.groupBy({
        by: ['picker_id'],
        where: { picker_id: { in: ids }, status: { code: { in: pickingRepo.ACTIVE_CODES } } },
        _count: { _all: true },
      })
    : [];
  const activeMap = Object.fromEntries(active.map((r) => [r.picker_id, r._count._all]));
  return { data: data.map((p) => ({ ...p, active_sessions: activeMap[p.id] ?? 0 })), total };
};

const findById    = (id) => prisma.picker.findUnique({ where: { id }, select: { ...SELECT, password_hash: true } });
const findByPhone = (phone_country, phone_number) =>
  prisma.picker.findFirst({ where: { phone_country, phone_number, is_deleted: false }, select: { ...SELECT, password_hash: true } });

const create     = (data) => prisma.picker.create({ data, select: SELECT });
const update     = (id, data) => prisma.picker.update({ where: { id }, data, select: SELECT });
const softDelete = (id) => prisma.picker.update({ where: { id }, data: { is_deleted: true, is_active: false, deleted_at: new Date() }, select: SELECT });

const countActiveSessions = (picker_id) =>
  prisma.pickingSession.count({ where: { picker_id, status: { code: { in: pickingRepo.ACTIVE_CODES } } } });

// ── Stats ─────────────────────────────────────────────────────────────────────
const findStats = async (picker_id, { from, to } = {}) => {
  const df = dateFilter(from, to);
  const sessionWhere = { picker_id, ...df };

  const [allSessions, completedSessions, inProgressSessions, itemsAgg] = await Promise.all([
    prisma.pickingSession.findMany({ where: sessionWhere, select: { id: true, created_at: true, started_at: true, completed_at: true, error_count: true, status: { select: { code: true } } } }),
    prisma.pickingSession.count({ where: { ...sessionWhere, status: { code: 'completed' } } }),
    prisma.pickingSession.count({ where: { ...sessionWhere, status: { code: 'in_progress' } } }),
    prisma.pickingSessionItem.aggregate({
      where: { session: sessionWhere, status: { code: 'picked' } },
      _count: { id: true },
    }),
  ]);

  const totalSessions = allSessions.length;
  const totalErrors   = allSessions.reduce((s, x) => s + (x.error_count ?? 0), 0);
  const totalOrders   = allSessions.length; // 1 session = 1 commande
  const totalItemsPicked = itemsAgg._count.id ?? 0;
  const successRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  // Durée moyenne (sessions terminées uniquement)
  const durSessions = allSessions.filter(s => s.started_at && s.completed_at);
  const avgDurationMin = durSessions.length > 0
    ? Math.round(durSessions.reduce((sum, s) => sum + (new Date(s.completed_at) - new Date(s.started_at)) / 60000, 0) / durSessions.length)
    : 0;

  // Répartition quotidienne (période demandée, 30 jours max ; 7 jours par défaut)
  const days = from ? Math.ceil((new Date(to||Date.now()) - new Date(from)) / 86400000) + 1 : 7;
  const n = Math.min(Math.max(days, 1), 30);
  const dailyData = Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (n - 1 - i));
    const dateStr = d.toISOString().split('T')[0];
    const daySessions = allSessions.filter(s => s.created_at && new Date(s.created_at).toISOString().startsWith(dateStr));
    return { date: dateStr, label: d.toLocaleDateString('fr-MA', { weekday: 'short', day:'numeric' }), sessions: daySessions.length, errors: daySessions.reduce((s,x)=>s+(x.error_count??0),0) };
  });

  return { total_sessions: totalSessions, completed_sessions: completedSessions, in_progress_sessions: inProgressSessions, cancelled_sessions: allSessions.filter(s=>s.status?.code==='cancelled').length, total_orders: totalOrders, total_items_picked: totalItemsPicked, total_errors: totalErrors, success_rate: successRate, avg_duration_min: avgDurationMin, daily: dailyData };
};

// ── Sessions liées ────────────────────────────────────────────────────────────
const findSessions = async (picker_id, { page = 1, limit = 25, status_code, from, to } = {}) => {
  const df = dateFilter(from, to);
  const where = { picker_id, ...df };
  if (status_code) where.status = { code: status_code };

  const [data, total] = await Promise.all([
    prisma.pickingSession.findMany({
      where,
      include: {
        order: { select: { id: true, total_ttc: true, customer: { select: { name: true, phone_number: true } } } },
        node:   { select: { id: true, code: true, name_fr: true } },
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

// ── Commandes préparées ───────────────────────────────────────────────────────
const findOrders = async (picker_id, { page = 1, limit = 25, status_code, from, to } = {}) => {
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
            confirmed_slot: { select: { name_fr: true, slot_start: true, slot_end: true, specific_date: true } },
            items: {
              include: {
                sku:    { select: { id: true, name_fr: true, name_ar: true, sku_code: true, ean13: true, price: true } },
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
            location:   { select: { label: true, aisle: true, shelf: true } },
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

module.exports = { findAll, findById, findByPhone, create, update, softDelete, countActiveSessions, findStats, findSessions, findOrders };
