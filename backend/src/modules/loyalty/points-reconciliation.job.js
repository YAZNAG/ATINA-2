const prisma = require('../../config/database');
const { audit } = require('../../utils/audit');

/**
 * Rapprochement nocturne du livre des points (classeur, Annuaire Clients >
 * Points & Fidélité : « un job nocturne compare SUM(amount) et points_balance et
 * logue tout écart »).
 *
 *  - points_transactions (APPEND-ONLY) est la source de vérité ;
 *    customers.points_balance est un cache, jamais recalculé à l'affichage ;
 *  - le job NE CORRIGE RIEN : chaque écart est journalisé dans audit_logs
 *    (action POINTS_RECONCILIATION_GAP) pour investigation et, le cas échéant,
 *    ajustement manuel motivé ;
 *  - planification : chaque nuit à 03:00, heure de Casablanca (setTimeout
 *    recalculé à chaque exécution, sans dépendance externe). Désactivable par
 *    POINTS_RECONCILIATION_DISABLED=1.
 */

const TIME_ZONE = 'Africa/Casablanca';
const RUN_HOUR = 3;
const GAPS_IN_SUMMARY = 100;

let timer = null;
let nextRunAt = null;
let running = null;
let lastSummary = null;

/**
 * Compare, pour chaque client, SUM(points) du livre et customers.points_balance.
 * @param {object} [options]
 * @param {import('express').Request|null} [options.req]  requête back-office (lancement manuel) ou null (job)
 * @param {string} [options.trigger]                      'schedule' | 'manual'
 * @returns {Promise<object>} résumé de l'exécution
 */
async function runReconciliation({ req = null, trigger = 'manual' } = {}) {
  if (running) return running; // une seule exécution à la fois
  running = (async () => {
    const startedAt = new Date();
    const [{ customers_checked: checked } = {}] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS customers_checked FROM customers`;

    const gaps = await prisma.$queryRaw`
      SELECT c.id, c.name, c.points_balance, COALESCE(s.ledger_sum, 0)::bigint AS ledger_sum
      FROM customers c
      LEFT JOIN (
        SELECT customer_id, SUM(points)::bigint AS ledger_sum
        FROM points_transactions
        GROUP BY customer_id
      ) s ON s.customer_id = c.id
      WHERE c.points_balance <> COALESCE(s.ledger_sum, 0)
      ORDER BY c.id`;

    let totalGap = 0;
    const details = [];
    for (const g of gaps) {
      const ledgerSum = Number(g.ledger_sum);
      const gap = Number(g.points_balance) - ledgerSum;
      totalGap += gap;
      // eslint-disable-next-line no-await-in-loop
      await audit(req, {
        action: 'POINTS_RECONCILIATION_GAP',
        resource: 'customers',
        resource_id: g.id,
        old_values: { points_balance: g.points_balance },
        new_values: { ledger_sum: ledgerSum, gap, trigger, run_at: startedAt.toISOString() },
      });
      if (details.length < GAPS_IN_SUMMARY) {
        details.push({ customer_id: g.id, name: g.name, points_balance: g.points_balance, ledger_sum: ledgerSum, gap });
      }
    }

    const finishedAt = new Date();
    const summary = {
      trigger,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_ms: finishedAt - startedAt,
      customers_checked: Number(checked ?? 0),
      gaps_count: gaps.length,
      total_gap: totalGap,
      gaps: details,
      gaps_truncated: gaps.length > details.length,
      next_run_at: nextRunAt,
    };
    lastSummary = summary;
    const msg = `[points-reconciliation] ${summary.customers_checked} client(s) contrôlé(s), ${summary.gaps_count} écart(s)`;
    if (summary.gaps_count) console.warn(`${msg} — écart total ${totalGap} pt(s), détail dans audit_logs (POINTS_RECONCILIATION_GAP)`);
    else console.log(msg);
    return summary;
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
}

// ── Planification 03:00 heure de Casablanca ──────────────────────────────────

/** Composantes date/heure d'un instant dans le fuseau donné. */
function zonedParts(date, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const v = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
  return { year: v.year, month: v.month, day: v.day, hour: v.hour % 24, minute: v.minute, second: v.second };
}

/** Décalage (ms) du fuseau par rapport à UTC à l'instant donné. */
function zoneOffset(date, timeZone = TIME_ZONE) {
  const p = zonedParts(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

/** Prochain instant où il est HH:00 à Casablanca (strictement après `now`). */
function nextRunDate(now = new Date(), hour = RUN_HOUR, timeZone = TIME_ZONE) {
  const local = zonedParts(now, timeZone);
  for (let addDays = 0; addDays <= 2; addDays += 1) {
    const wallUtc = Date.UTC(local.year, local.month - 1, local.day + addDays, hour, 0, 0);
    // Deux passes pour tenir compte d'un éventuel changement d'heure.
    let t = wallUtc - zoneOffset(new Date(wallUtc), timeZone);
    t = wallUtc - zoneOffset(new Date(t), timeZone);
    if (t > now.getTime() + 1000) return new Date(t);
  }
  return new Date(now.getTime() + 24 * 3600 * 1000);
}

function scheduleNext() {
  nextRunAt = nextRunDate();
  const delay = Math.max(1000, nextRunAt.getTime() - Date.now());
  timer = setTimeout(async () => {
    try {
      await runReconciliation({ trigger: 'schedule' });
    } catch (err) {
      console.error('[points-reconciliation] échec :', err.message);
    } finally {
      if (timer) scheduleNext();
    }
  }, delay);
  if (typeof timer.unref === 'function') timer.unref();
}

/** Démarre la planification nocturne (idempotent). À appeler une fois au démarrage du serveur. */
function start() {
  const flag = String(process.env.POINTS_RECONCILIATION_DISABLED ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(flag)) {
    console.log('[points-reconciliation] désactivé (POINTS_RECONCILIATION_DISABLED)');
    return null;
  }
  if (timer) return nextRunAt;
  scheduleNext();
  console.log(`[points-reconciliation] prochain rapprochement : ${nextRunAt.toISOString()} (03:00 ${TIME_ZONE})`);
  return nextRunAt;
}

function stop() {
  if (timer) clearTimeout(timer);
  timer = null;
  nextRunAt = null;
}

const status = () => ({ scheduled: Boolean(timer), next_run_at: nextRunAt, last_run: lastSummary });

module.exports = { runReconciliation, start, stop, status, nextRunDate };
