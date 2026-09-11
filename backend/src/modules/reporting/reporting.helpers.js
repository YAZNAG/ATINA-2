/**
 * Reporting helpers — parsing des filtres communs (période, node, région…)
 * et petites conversions (BigInt / Decimal → Number).
 *
 * Les bornes de période sont calculées dans le fuseau métier (Africa/Casablanca)
 * directement par PostgreSQL pour éviter tout décalage lié au fuseau du serveur.
 */
const { Prisma } = require('@prisma/client');
const prisma = require('../../config/database');

const TZ = process.env.REPORTING_TZ || 'Africa/Casablanca';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIODS = { day: 1, week: 7, month: 30 };
const MAX_CUSTOM_DAYS = 366;

const bad = (message) => ({ statusCode: 400, message });

/** Convertit BigInt / Decimal / string numérique en Number (null conservé). */
function num(v, digits) {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'bigint' ? Number(v) : Number(v.toString ? v.toString() : v);
  if (!Number.isFinite(n)) return null;
  return digits === undefined ? n : Number(n.toFixed(digits));
}

/** Nombre, 0 par défaut. */
const n0 = (v, digits) => num(v, digits) ?? 0;

function uuidOrNull(v, label) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim();
  if (!UUID_RE.test(s)) throw bad(`Identifiant ${label} invalide`);
  return s;
}

function intOrNull(v, label) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw bad(`Identifiant ${label} invalide`);
  return n;
}

function positiveNumberOrNull(v, label) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw bad(`${label} doit être un nombre positif`);
  return n;
}

function pageParams(q, defLimit = 50, maxLimit = 500) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(q.limit, 10) || defLimit));
  return { page, limit, offset: (page - 1) * limit };
}

/**
 * Résout la période demandée.
 *  - period = day | week | month (jour courant, 7 derniers jours, 30 derniers jours)
 *  - ou from / to (AAAA-MM-JJ, bornes incluses)
 * Retourne { start, end (exclusif), period, days, granularity, from, to }.
 */
async function resolveRange(q = {}) {
  const { from, to } = q;
  let rows;
  let period;
  if (from || to) {
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
      throw bad('Format de date invalide (AAAA-MM-JJ attendu)');
    }
    const f = from || to;
    const t = to || from;
    if (f > t) throw bad('La date de début doit précéder la date de fin');
    period = 'custom';
    rows = await prisma.$queryRaw`
      SELECT ((${f}::date)::timestamp AT TIME ZONE ${TZ})           AS start,
             (((${t}::date) + 1)::timestamp AT TIME ZONE ${TZ})     AS "end",
             ((${t}::date) - (${f}::date) + 1)::int                 AS days,
             ${f}::text AS from_date, ${t}::text AS to_date`;
  } else {
    period = PERIODS[q.period] ? q.period : 'day';
    const back = PERIODS[period] - 1;
    rows = await prisma.$queryRaw`
      SELECT ((date_trunc('day', now() AT TIME ZONE ${TZ}) - (${back}::int * interval '1 day')) AT TIME ZONE ${TZ}) AS start,
             ((date_trunc('day', now() AT TIME ZONE ${TZ}) + interval '1 day') AT TIME ZONE ${TZ})                 AS "end",
             ${back + 1}::int AS days,
             to_char(date_trunc('day', now() AT TIME ZONE ${TZ}) - (${back}::int * interval '1 day'), 'YYYY-MM-DD') AS from_date,
             to_char(now() AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS to_date`;
  }
  const r = rows[0];
  const days = n0(r.days);
  if (days > MAX_CUSTOM_DAYS) throw bad(`La période ne peut pas dépasser ${MAX_CUSTOM_DAYS} jours`);
  const granularity = days <= 1 ? 'hour' : days <= 92 ? 'day' : 'week';
  return {
    start: new Date(r.start),
    end: new Date(r.end),
    period,
    days,
    granularity,
    from: r.from_date,
    to: r.to_date,
  };
}

/** Filtres communs node / région (validation). */
function scopeFilters(q = {}) {
  return {
    node_id: uuidOrNull(q.node_id, 'node'),
    region_id: uuidOrNull(q.region_id, 'région'),
  };
}

/** Code statut de commande (simple validation de forme). */
function statusCodeOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim();
  if (!/^[a-z_]{2,50}$/i.test(s)) throw bad('Statut de commande invalide');
  return s.toLowerCase();
}

/** Assemble des conditions Prisma.sql avec AND (TRUE si vide). */
function andSql(conds) {
  const list = conds.filter(Boolean);
  return list.length ? Prisma.join(list, ' AND ') : Prisma.sql`TRUE`;
}

/** Période → objet sérialisable pour le front. */
function periodOut(range) {
  return {
    period: range.period,
    from: range.from,
    to: range.to,
    start: range.start,
    end: range.end,
    days: range.days,
    granularity: range.granularity,
  };
}

module.exports = {
  Prisma,
  TZ,
  num,
  n0,
  bad,
  uuidOrNull,
  intOrNull,
  positiveNumberOrNull,
  pageParams,
  resolveRange,
  scopeFilters,
  statusCodeOrNull,
  andSql,
  periodOut,
};
