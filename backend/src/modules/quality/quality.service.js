const prisma = require('../../config/database');

// Contrôles qualité (US-069 création, US-070 historique filtrable par type / score / date).
// Un contrôle est une trace : pas de modification ni de suppression.

const RESULTS = ['ok', 'ko'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LIST_INCLUDE = {
  node:       { select: { id: true, code: true, name_fr: true } },
  check_type: { select: { id: true, code: true, name_fr: true, name_ar: true } },
  picking_session: {
    select: {
      id: true, started_at: true, completed_at: true, error_count: true,
      status: { select: { code: true, name_fr: true } },
      picker: { select: { id: true, name: true } },
    },
  },
  order: { select: { id: true, total_ttc: true, customer: { select: { name: true } } } },
};

const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  picking_session: {
    select: {
      id: true, order_id: true, started_at: true, completed_at: true, error_count: true, created_at: true,
      status: { select: { code: true, name_fr: true } },
      picker: { select: { id: true, name: true, phone_country: true, phone_number: true } },
      node:   { select: { code: true, name_fr: true } },
      _count: { select: { items: true } },
    },
  },
  order: {
    select: {
      id: true, total_ttc: true, created_at: true,
      status:   { select: { code: true, name_fr: true } },
      customer: { select: { name: true, phone_country: true, phone_number: true } },
    },
  },
};

const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const toInt = (v) => (v === undefined || v === null || v === '' ? null : Number.parseInt(v, 10));

class QualityService {
  _where(q = {}) {
    for (const k of ['node_id', 'check_type_id', 'picking_session_id', 'order_id']) {
      if (q[k] && !UUID_RE.test(String(q[k]))) throw { statusCode: 400, message: `Filtre invalide : ${k}` };
    }
    const w = {};
    if (q.node_id) w.node_id = q.node_id;
    if (q.check_type_id) w.check_type_id = q.check_type_id;
    else if (q.check_type) w.check_type = { code: q.check_type };
    if (q.result && RESULTS.includes(String(q.result).toLowerCase())) w.result = String(q.result).toLowerCase();
    if (q.picking_session_id) w.picking_session_id = q.picking_session_id;
    if (q.order_id) w.order_id = q.order_id;
    if (q.checked_by) { const c = toInt(q.checked_by); if (Number.isInteger(c)) w.checked_by = c; }

    const smin = toInt(q.score_min); const smax = toInt(q.score_max);
    if (Number.isInteger(smin) || Number.isInteger(smax)) {
      w.score = {};
      if (Number.isInteger(smin)) w.score.gte = smin;
      if (Number.isInteger(smax)) w.score.lte = smax;
    }
    if (q.date_from || q.date_to) {
      const f = {};
      if (q.date_from) { const d = new Date(q.date_from); if (!Number.isNaN(d.getTime())) f.gte = d; }
      if (q.date_to)   { const d = new Date(q.date_to);   if (!Number.isNaN(d.getTime())) f.lte = endOfDay(d); }
      if (Object.keys(f).length) w.created_at = f;
    }
    return w;
  }

  async _attachCheckers(rows) {
    const ids = [...new Set(rows.map((r) => r.checked_by).filter((v) => v != null))];
    if (!ids.length) return rows.map((r) => ({ ...r, checker: null }));
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, full_name: true, email: true } });
    const byId = Object.fromEntries(users.map((u) => [u.id, u]));
    return rows.map((r) => ({ ...r, checker: r.checked_by != null ? (byId[r.checked_by] ?? null) : null }));
  }

  async list(q = {}) {
    const page  = Math.max(1, parseInt(q.page || 1, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit || 25, 10) || 25));
    const where = this._where(q);
    const [rows, total] = await Promise.all([
      prisma.qualityCheck.findMany({ where, include: LIST_INCLUDE, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.qualityCheck.count({ where }),
    ]);
    return { data: await this._attachCheckers(rows), pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async exportRows(q = {}) {
    const rows = await prisma.qualityCheck.findMany({ where: this._where(q), include: LIST_INCLUDE, orderBy: { created_at: 'desc' }, take: 5000 });
    return this._attachCheckers(rows);
  }

  /** Agrégats (US-070) : total, OK/KO, score moyen, répartition par type. */
  async stats(q = {}) {
    const where = this._where(q);
    const [byResult, avg, byType, types] = await Promise.all([
      prisma.qualityCheck.groupBy({ by: ['result'], where, _count: { _all: true } }),
      prisma.qualityCheck.aggregate({ where, _avg: { score: true } }),
      prisma.qualityCheck.groupBy({ by: ['check_type_id', 'result'], where, _count: { _all: true }, _avg: { score: true } }),
      prisma.qualityCheckType.findMany({ select: { id: true, code: true, name_fr: true } }),
    ]);
    const ok = byResult.find((r) => r.result === 'ok')?._count._all ?? 0;
    const ko = byResult.find((r) => r.result === 'ko')?._count._all ?? 0;
    const total = ok + ko;
    const typeMap = {};
    for (const r of byType) {
      const t = (typeMap[r.check_type_id] ||= { total: 0, ok: 0, ko: 0, score_sum: 0, score_n: 0 });
      t.total += r._count._all;
      if (r.result === 'ok') t.ok += r._count._all;
      if (r.result === 'ko') t.ko += r._count._all;
      if (r._avg.score != null) { t.score_sum += r._avg.score * r._count._all; t.score_n += r._count._all; }
    }
    return {
      total, ok, ko,
      ok_rate: total > 0 ? Math.round((ok / total) * 100) : null,
      avg_score: avg._avg.score != null ? Math.round(avg._avg.score * 10) / 10 : null,
      by_type: types.map((t) => {
        const a = typeMap[t.id] || { total: 0, ok: 0, ko: 0, score_n: 0 };
        return {
          check_type: t, total: a.total, ok: a.ok, ko: a.ko,
          ok_rate: a.total > 0 ? Math.round((a.ok / a.total) * 100) : null,
          avg_score: a.score_n > 0 ? Math.round((a.score_sum / a.score_n) * 10) / 10 : null,
        };
      }),
    };
  }

  async getById(id) {
    if (!UUID_RE.test(String(id))) throw { statusCode: 400, message: 'Identifiant de contrôle invalide' };
    const row = await prisma.qualityCheck.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!row) throw { statusCode: 404, message: 'Contrôle qualité introuvable' };
    const [withChecker] = await this._attachCheckers([row]);
    return withChecker;
  }

  async lookups() {
    const [types, nodes] = await Promise.all([
      prisma.qualityCheckType.findMany({ select: { id: true, code: true, name_fr: true, name_ar: true }, orderBy: { name_fr: 'asc' } }),
      prisma.node.findMany({ where: { is_deleted: false }, select: { id: true, code: true, name_fr: true, is_active: true }, orderBy: { code: 'asc' } }),
    ]);
    return { types, nodes };
  }

  /** Sessions de picking récentes d'un node (sélection dans le formulaire de création). */
  async sessionsLookup({ node_id, id } = {}) {
    if (id && !UUID_RE.test(String(id))) return [];
    return prisma.pickingSession.findMany({
      where: { ...(node_id && { node_id }), ...(id && { id }) },
      select: {
        id: true, order_id: true, node_id: true, created_at: true, completed_at: true,
        status: { select: { code: true, name_fr: true } },
        picker: { select: { name: true } },
        order:  { select: { customer: { select: { name: true } } } },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
  }

  async create(body = {}, userId = null) {
    const result = String(body.result || '').trim().toLowerCase();
    if (!RESULTS.includes(result)) throw { statusCode: 400, message: 'Résultat requis : OK ou KO' };

    // Type : par id ou par code
    let type = null;
    if (body.check_type_id) type = await prisma.qualityCheckType.findUnique({ where: { id: body.check_type_id } }).catch(() => null);
    else if (body.check_type) type = await prisma.qualityCheckType.findUnique({ where: { code: String(body.check_type) } });
    if (!type) throw { statusCode: 400, message: 'Type de contrôle requis ou introuvable' };

    // Score (optionnel) : entier 0 à 100
    let score = null;
    if (body.score !== undefined && body.score !== null && body.score !== '') {
      score = Number(body.score);
      if (!Number.isInteger(score) || score < 0 || score > 100) throw { statusCode: 400, message: 'Le score doit être un entier entre 0 et 100' };
    }

    const anomalies = body.anomalies != null ? String(body.anomalies).trim() || null : null;
    const notes     = body.notes != null ? String(body.notes).trim() || null : null;
    if (result === 'ko' && !anomalies) throw { statusCode: 400, message: 'Un contrôle KO doit décrire les anomalies constatées' };

    // Référence : session de picking et/ou commande (au moins une)
    let session = null;
    let order = null;
    if (body.picking_session_id) {
      if (!UUID_RE.test(String(body.picking_session_id))) throw { statusCode: 400, message: 'Session de picking invalide' };
      session = await prisma.pickingSession.findUnique({ where: { id: body.picking_session_id }, select: { id: true, node_id: true, order_id: true } });
      if (!session) throw { statusCode: 404, message: 'Session de picking introuvable' };
    }
    const orderId = body.order_id || session?.order_id || null;
    if (orderId) {
      if (!UUID_RE.test(String(orderId))) throw { statusCode: 400, message: 'Commande invalide' };
      order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, node_id: true } });
      if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
    }
    if (!session && !order) throw { statusCode: 400, message: 'Indiquez la session de picking ou la commande contrôlée' };
    if (session && order && session.order_id !== order.id)
      throw { statusCode: 400, message: 'La commande ne correspond pas à la session de picking' };

    const node_id = body.node_id || session?.node_id || order?.node_id;
    if (!node_id) throw { statusCode: 400, message: 'Node requis' };
    const node = await prisma.node.findFirst({ where: { id: node_id, is_deleted: false }, select: { id: true } });
    if (!node) throw { statusCode: 400, message: 'Node introuvable' };
    if ((session && session.node_id !== node_id) || (order && order.node_id !== node_id))
      throw { statusCode: 400, message: "La référence contrôlée n'appartient pas à ce node" };

    const created = await prisma.qualityCheck.create({
      data: {
        node_id,
        check_type_id: type.id,
        picking_session_id: session?.id ?? null,
        order_id: order?.id ?? null,
        result,
        score,
        anomalies,
        notes,
        checked_by: userId ?? null,
      },
      include: LIST_INCLUDE,
    });
    const [withChecker] = await this._attachCheckers([created]);
    return withChecker;
  }
}

module.exports = new QualityService();
