const prisma = require('../../config/database');

/**
 * Log & Audit (Admin / Configuration) — LECTURE SEULE.
 *  - audit_logs    : APPEND-ONLY (trigger PG), jamais modifié ni supprimé.
 *  - notifications : journal des notifications envoyées aux clients.
 * Pagination par curseur sur la date (created_at / sent_at) + id.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const EXPORT_MAX = 10000;

const clampLimit = (v) => Math.min(MAX_LIMIT, Math.max(1, Number(v) || DEFAULT_LIMIT));

/** Date « YYYY-MM-DD » ou ISO → Date (null si invalide). endOfDay : borne exclusive au lendemain. */
const parseDate = (v, endOfDay = false) => {
  if (!v) return null;
  const s = String(v).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00.000Z`) : new Date(s);
  if (Number.isNaN(d.getTime())) throw { statusCode: 400, message: `Date invalide : ${s}` };
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(s)) d.setUTCDate(d.getUTCDate() + 1);
  return d;
};

const periodFilter = (field, date_from, date_to) => {
  const from = parseDate(date_from);
  const to = parseDate(date_to, true);
  if (!from && !to) return {};
  const isDay = date_to && /^\d{4}-\d{2}-\d{2}$/.test(String(date_to).trim());
  return {
    [field]: {
      ...(from && { gte: from }),
      ...(to && (isDay ? { lt: to } : { lte: to })),
    },
  };
};

const encodeCursor = (date, id) =>
  Buffer.from(JSON.stringify({ t: new Date(date).toISOString(), id })).toString('base64url');

const decodeCursor = (cursor) => {
  if (!cursor) return null;
  try {
    const { t, id } = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
    const d = new Date(t);
    if (!id || Number.isNaN(d.getTime())) throw new Error('bad');
    return { t: d, id };
  } catch {
    throw { statusCode: 400, message: 'Curseur de pagination invalide' };
  }
};

/** Ajoute la condition « strictement après le curseur » (tri décroissant date, id). */
const withCursor = (where, field, cursor) => {
  const c = decodeCursor(cursor);
  if (!c) return where;
  return {
    AND: [
      where,
      { OR: [{ [field]: { lt: c.t } }, { [field]: c.t, id: { lt: c.id } }] },
    ],
  };
};

/* ───────────────────────────── CSV ───────────────────────────── */

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (headers, rows) =>
  String.fromCharCode(0xfeff) + [headers.map(csvCell).join(';'), ...rows.map((r) => r.map(csvCell).join(';'))].join('\r\n');

const fmtDate = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) : '');

/* ─────────────────────────── Journal d'audit ─────────────────────────── */

const USER_SELECT = { select: { id: true, full_name: true, email: true } };

const buildAuditWhere = ({ user_id, resource, action, resource_id, search, date_from, date_to } = {}) => {
  const where = {
    ...(user_id !== undefined && user_id !== '' && (
      user_id === 'system' ? { user_id: null } : { user_id: Number(user_id) }
    )),
    ...(resource && { resource: String(resource) }),
    ...(action && { action: String(action) }),
    ...(resource_id && { resource_id: { contains: String(resource_id).trim(), mode: 'insensitive' } }),
    ...periodFilter('created_at', date_from, date_to),
  };
  if (where.user_id !== undefined && where.user_id !== null && !Number.isInteger(where.user_id)) {
    throw { statusCode: 400, message: 'Utilisateur invalide' };
  }
  if (search) {
    const q = String(search).trim();
    where.OR = [
      { resource_id: { contains: q, mode: 'insensitive' } },
      { resource: { contains: q, mode: 'insensitive' } },
      { action: { contains: q, mode: 'insensitive' } },
      { user: { full_name: { contains: q, mode: 'insensitive' } } },
      { user: { email: { contains: q, mode: 'insensitive' } } },
    ];
  }
  return where;
};

class AdminAuditService {
  async listLogs(params = {}) {
    const limit = clampLimit(params.limit);
    const baseWhere = buildAuditWhere(params);
    const where = withCursor(baseWhere, 'created_at', params.cursor);
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: USER_SELECT },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      }),
      params.cursor ? Promise.resolve(null) : prisma.auditLog.count({ where: baseWhere }),
    ]);
    const has_more = rows.length > limit;
    const data = has_more ? rows.slice(0, limit) : rows;
    const last = data[data.length - 1];
    return {
      data,
      pagination: {
        limit,
        total,
        has_more,
        next_cursor: has_more && last ? encodeCursor(last.created_at, last.id) : null,
      },
    };
  }

  async getLog(id) {
    const row = await prisma.auditLog.findUnique({ where: { id }, include: { user: USER_SELECT } });
    if (!row) throw { statusCode: 404, message: "Événement d'audit introuvable" };
    return row;
  }

  async logFacets() {
    const [resources, actions, users] = await Promise.all([
      prisma.auditLog.groupBy({ by: ['resource'], _count: { _all: true }, orderBy: { resource: 'asc' } }),
      prisma.auditLog.groupBy({ by: ['action'], _count: { _all: true }, orderBy: { action: 'asc' } }),
      prisma.auditLog.groupBy({ by: ['user_id'], _count: { _all: true } }),
    ]);
    const userIds = users.map((u) => u.user_id).filter((v) => v !== null);
    const userRows = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, full_name: true, email: true } })
      : [];
    const byId = Object.fromEntries(userRows.map((u) => [u.id, u]));
    return {
      resources: resources.map((r) => ({ value: r.resource, count: r._count._all })),
      actions: actions.map((a) => ({ value: a.action, count: a._count._all })),
      users: users
        .map((u) => (u.user_id === null
          ? { id: 'system', full_name: 'Système', email: null, count: u._count._all }
          : { ...(byId[u.user_id] || { id: u.user_id, full_name: `Utilisateur #${u.user_id}`, email: null }), count: u._count._all }))
        .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name), 'fr')),
    };
  }

  async exportLogs(params = {}) {
    const rows = await prisma.auditLog.findMany({
      where: buildAuditWhere(params),
      include: { user: USER_SELECT },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: EXPORT_MAX,
    });
    const headers = ['Date', 'Auteur', 'Email', 'Action', 'Entité', 'ID entité', 'Avant', 'Après', 'IP', 'User-Agent'];
    return toCsv(headers, rows.map((r) => [
      fmtDate(r.created_at),
      r.user?.full_name || (r.user_id ? `#${r.user_id}` : 'Système'),
      r.user?.email || '',
      r.action,
      r.resource,
      r.resource_id,
      r.old_values,
      r.new_values,
      r.ip,
      r.user_agent,
    ]));
  }

  /* ───────────────────────── Notifications (log) ───────────────────────── */

  _notifWhere({ event_code, channel_id, is_read, customer_id, search, date_from, date_to, status_id, status } = {}) {
    const where = {
      ...(event_code && { event_code: String(event_code) }),
      // Statut de la notification (référentiel notification_statuses) : uuid ou code ; « none » = sans statut.
      ...(status_id && (status_id === 'none' ? { status_id: null } : { status_id: String(status_id) })),
      ...(!status_id && status && { status: { code: String(status) } }),
      ...(channel_id && (channel_id === 'none' ? { channel_id: null } : { channel_id: String(channel_id) })),
      ...(is_read !== undefined && is_read !== '' && { is_read: is_read === 'true' || is_read === true }),
      ...(customer_id && { customer_id: String(customer_id) }),
      ...periodFilter('sent_at', date_from, date_to),
    };
    if (search) {
      const q = String(search).trim();
      where.OR = [
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { phone_number: { contains: q, mode: 'insensitive' } } },
        { title_fr: { contains: q, mode: 'insensitive' } },
        { title_ar: { contains: q, mode: 'insensitive' } },
        { body_fr: { contains: q, mode: 'insensitive' } },
        { event_code: { contains: q, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  _notifInclude() {
    return {
      customer: { select: { id: true, name: true, phone_country: true, phone_number: true } },
      channel: { select: { id: true, code: true, name_fr: true, name_ar: true } },
      status: { select: { id: true, code: true, name_fr: true, name_ar: true } },
    };
  }

  async listNotifications(params = {}) {
    const limit = clampLimit(params.limit);
    const baseWhere = this._notifWhere(params);
    const where = withCursor(baseWhere, 'sent_at', params.cursor);
    const [rows, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: this._notifInclude(),
        orderBy: [{ sent_at: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      }),
      params.cursor ? Promise.resolve(null) : prisma.notification.count({ where: baseWhere }),
    ]);
    const has_more = rows.length > limit;
    const data = has_more ? rows.slice(0, limit) : rows;
    const last = data[data.length - 1];
    return {
      data,
      pagination: {
        limit,
        total,
        has_more,
        next_cursor: has_more && last ? encodeCursor(last.sent_at, last.id) : null,
      },
    };
  }

  async notificationFacets() {
    const [events, channels, statuses, statusCounts] = await Promise.all([
      prisma.notification.groupBy({ by: ['event_code'], _count: { _all: true }, orderBy: { event_code: 'asc' } }),
      prisma.notificationChannel.findMany({ select: { id: true, code: true, name_fr: true }, orderBy: { name_fr: 'asc' } }),
      prisma.notificationDeliveryStatus.findMany({ select: { id: true, code: true, name_fr: true, name_ar: true } }),
      prisma.notification.groupBy({ by: ['status_id'], _count: { _all: true } }),
    ]);
    const ORDER = ['pending', 'sent', 'delivered', 'read', 'failed'];
    return {
      event_codes: events.map((e) => ({ value: e.event_code, count: e._count._all })),
      channels,
      statuses: statuses
        .sort((a, b) => ORDER.indexOf(a.code) - ORDER.indexOf(b.code))
        .map((s) => ({ ...s, count: statusCounts.find((c) => c.status_id === s.id)?._count._all ?? 0 })),
    };
  }

  async exportNotifications(params = {}) {
    const rows = await prisma.notification.findMany({
      where: this._notifWhere(params),
      include: this._notifInclude(),
      orderBy: [{ sent_at: 'desc' }, { id: 'desc' }],
      take: EXPORT_MAX,
    });
    const headers = [
      'Date d\'envoi', 'Client', 'Téléphone', 'Canal', 'Type (événement)',
      'Titre (FR)', 'Contenu (FR)', 'Titre (AR)', 'Contenu (AR)', 'Statut', 'Lu', 'Date de lecture', 'Commande',
    ];
    return toCsv(headers, rows.map((n) => [
      fmtDate(n.sent_at),
      n.customer?.name || '',
      n.customer ? `${n.customer.phone_country || ''}${n.customer.phone_number || ''}` : '',
      n.channel?.name_fr || n.channel?.code || '',
      n.event_code,
      n.title_fr,
      n.body_fr,
      n.title_ar || '',
      n.body_ar || '',
      n.status?.name_fr || n.status?.code || '',
      n.is_read ? 'Lu' : 'Non lu',
      n.read_at ? fmtDate(n.read_at) : '',
      n.order_id || '',
    ]));
  }
}

module.exports = new AdminAuditService();
