/**
 * Gamification — participations (game_plays) en LECTURE SEULE (US-082).
 *
 * Les lignes sont insérées par l'app cliente (voir gamification.engine.js) ;
 * le back-office ne crée, ne modifie ni ne supprime aucune participation.
 */
const prisma = require('../../config/database');
const R = require('./gamification.rules');

const { bad } = R;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EXPORT_MAX = 10000;

const playInclude = {
  game: {
    select: {
      id: true, name_fr: true, name_ar: true, is_deleted: true, node_id: true,
      node: { select: { id: true, code: true, name_fr: true } },
      game_type: { select: { id: true, code: true, name_fr: true } },
      unlock_condition: { select: { id: true, code: true, name_fr: true } },
    },
  },
  prize: {
    select: {
      id: true, name_fr: true, name_ar: true, value: true, awarded_count: true, stock_limit: true,
      prize_type: { select: { id: true, code: true, name_fr: true } },
    },
  },
  customer: { select: { id: true, name: true, phone_country: true, phone_number: true } },
  order: {
    select: {
      id: true, total_ttc: true, created_at: true,
      status: { select: { code: true, name_fr: true, is_terminal: true } },
    },
  },
};

/** Bornes [start, end[ d'un intervalle de dates (AAAA-MM-JJ) dans le fuseau Africa/Casablanca. */
async function dayBounds(from, to) {
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) throw bad('Format de date invalide (AAAA-MM-JJ attendu)');
  if (from && to && from > to) throw bad('La date de début doit précéder la date de fin');
  const [row] = await prisma.$queryRaw`
    SELECT CASE WHEN ${from || null}::date IS NULL THEN NULL
                ELSE ((${from || null}::date)::timestamp AT TIME ZONE ${R.TZ}) END AS start,
           CASE WHEN ${to || null}::date IS NULL THEN NULL
                ELSE (((${to || null}::date) + 1)::timestamp AT TIME ZONE ${R.TZ}) END AS "end"`;
  return { start: row.start, end: row.end };
}

/** Construit le filtre Prisma à partir des paramètres de l'écran (filtres conjoints). */
async function buildWhere(q = {}) {
  const where = {};
  const and = [];
  const game = {};
  if (q.node_id) game.node_id = R.uuid(q.node_id, 'Node');
  if (q.game_type_id) game.game_type_id = R.uuid(q.game_type_id, 'Type de jeu');
  if (Object.keys(game).length) where.game = game;
  if (q.game_id) where.game_id = R.uuid(q.game_id, 'Jeu');
  if (q.prize_id) where.prize_id = R.uuid(q.prize_id, 'Lot');
  if (q.customer_id) where.customer_id = R.uuid(q.customer_id, 'Client');
  if (q.customer && String(q.customer).trim()) {
    const s = String(q.customer).trim();
    where.customer = {
      OR: [
        { name: { contains: s, mode: 'insensitive' } },
        { phone_number: { contains: s.replace(/\s+/g, '') } },
      ],
    };
  }
  if (q.result) {
    if (!['win', 'lose'].includes(q.result)) throw bad('Résultat invalide (win | lose)');
    where.result = q.result;
  }
  const now = new Date();
  switch (q.claim_status) {
    case undefined: case null: case '': break;
    case 'claimed':
      and.push({ result: 'win' }, { prize_id: { not: null } }, { claimed_at: { not: null } });
      break;
    case 'pending':
      and.push({ result: 'win' }, { prize_id: { not: null } }, { claimed_at: null }, { OR: [{ expires_at: null }, { expires_at: { gte: now } }] });
      break;
    case 'expired':
      and.push({ result: 'win' }, { prize_id: { not: null } }, { claimed_at: null }, { expires_at: { lt: now } });
      break;
    default: throw bad('Statut de réclamation invalide (claimed | pending | expired)');
  }
  if (q.date_from || q.date_to) {
    const { start, end } = await dayBounds(q.date_from, q.date_to);
    const played = {};
    if (start) played.gte = start;
    if (end) played.lt = end;
    and.push({ played_at: played });
  }
  if (q.has_active_order === 'true') {
    const gid = q.game_id ? R.uuid(q.game_id, 'Jeu') : null;
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT gp.id
        FROM gamification_plays gp
        JOIN order_items oi    ON oi.game_play_id = gp.id
        JOIN orders o          ON o.id = oi.order_id
        JOIN order_statuses os ON os.id = o.status_id
       WHERE o.is_deleted = false AND os.is_terminal = false
         AND (${gid}::uuid IS NULL OR gp.game_id = ${gid}::uuid)`;
    and.push({ id: { in: rows.map((r) => r.id) } });
  }
  if (and.length) where.AND = and;
  return where;
}

function plainPlay(p, now = new Date()) {
  return {
    ...p,
    prize: p.prize ? { ...p.prize, value: R.toNumOrNull(p.prize.value) } : null,
    order: p.order ? { ...p.order, total_ttc: Number(p.order.total_ttc) } : null,
    claim_status: R.claimStatus(p, now),
  };
}

/** GET /gamification/plays — liste paginée, filtres conjoints. */
async function listPlays(q = {}) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(q.limit, 10) || 25));
  const where = await buildWhere(q);
  const [total, rows, wins] = await Promise.all([
    prisma.gamificationPlay.count({ where }),
    prisma.gamificationPlay.findMany({
      where, include: playInclude, orderBy: { played_at: 'desc' }, skip: (page - 1) * limit, take: limit,
    }),
    prisma.gamificationPlay.count({ where: { AND: [where, { result: 'win' }] } }),
  ]);
  const now = new Date();
  return {
    data: rows.map((r) => plainPlay(r, now)),
    pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    summary: { total, wins, losses: total - wins },
  };
}

const CLAIM_LABELS = { claimed: 'Réclamé', pending: 'En attente', expired: 'Expiré' };

/** GET /gamification/plays/export — exactement le périmètre filtré, lignes aplaties pour CSV. */
async function exportPlays(q = {}) {
  const where = await buildWhere(q);
  const total = await prisma.gamificationPlay.count({ where });
  if (total > EXPORT_MAX) throw bad(`Export limité à ${EXPORT_MAX} lignes (${total} trouvées) : affinez les filtres.`);
  const rows = await prisma.gamificationPlay.findMany({ where, include: playInclude, orderBy: { played_at: 'desc' } });
  const now = new Date();
  return rows.map((r) => {
    const p = plainPlay(r, now);
    return {
      id: p.id,
      played_at: p.played_at,
      game: p.game?.name_fr ?? '',
      game_type: p.game?.game_type?.name_fr ?? '',
      node: p.game?.node?.code ?? '',
      unlock_condition: p.game?.unlock_condition?.name_fr ?? '',
      customer: p.customer?.name ?? '',
      customer_phone: p.customer ? `${p.customer.phone_country}${p.customer.phone_number}` : '',
      result: p.result === 'win' ? 'Gagné' : 'Perdu',
      prize: p.prize?.name_fr ?? '',
      prize_type: p.prize?.prize_type?.name_fr ?? '',
      claim_status: p.claim_status ? CLAIM_LABELS[p.claim_status] : '',
      claimed_at: p.claimed_at,
      expires_at: p.expires_at,
      order_id: p.order?.id ?? '',
      order_status: p.order?.status?.name_fr ?? '',
      order_total: p.order ? p.order.total_ttc : '',
    };
  });
}

/** GET /gamification/plays/:id — détail : lot, commande liée, transaction de points, code promo, lignes de commande. */
async function getPlay(id) {
  const pid = R.uuid(id, 'Participation', { required: true });
  const play = await prisma.gamificationPlay.findUnique({ where: { id: pid }, include: playInclude });
  if (!play) throw bad('Participation introuvable', 404);
  const [promocodes, pointsTxns, orderItems] = await Promise.all([
    prisma.promotion.findMany({
      where: { play_id: play.id },
      select: {
        id: true, code: true, value: true, min_order_amount: true, uses_max: true, uses_count: true,
        valid_from: true, valid_to: true, is_active: true, promo_type: { select: { code: true, name_fr: true } },
      },
    }),
    prisma.pointsTransaction.findMany({
      where: { customer_id: play.customer_id, type: 'prize_award', label: { contains: play.id } },
      select: { id: true, points: true, balance_after: true, label: true, created_at: true },
    }),
    prisma.$queryRaw`
      SELECT oi.id, oi.order_id, oi.qty::float AS qty, oi.sku_id, oi.pack_id,
             s.sku_code, s.name_fr AS sku_name, pk.name_fr AS pack_name,
             os.code AS order_status_code, os.name_fr AS order_status
        FROM order_items oi
        JOIN orders o          ON o.id = oi.order_id
        JOIN order_statuses os ON os.id = o.status_id
        LEFT JOIN skus s       ON s.id = oi.sku_id
        LEFT JOIN packs pk     ON pk.id = oi.pack_id
       WHERE oi.game_play_id = ${play.id}::uuid`,
  ]);
  return {
    ...plainPlay(play),
    promocodes: promocodes.map((c) => ({ ...c, value: Number(c.value), min_order_amount: Number(c.min_order_amount) })),
    points_transactions: pointsTxns,
    order_items: orderItems,
  };
}

module.exports = { listPlays, exportPlays, getPlay, buildWhere };
