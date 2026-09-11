/**
 * Passerelle PG NOTIFY → Socket.IO pour la disponibilité des packs (WF #23, US-102).
 *
 * Le trigger PostgreSQL (migration 20260910100000_pack_availability_trigger) émet
 * pg_notify('pack_availability', json) à chaque changement du flag packs.is_available
 * (ou de is_active / is_deleted / node_id). Ce module écoute ce canal avec une connexion
 * `pg` dédiée (LISTEN impossible via Prisma) et diffuse l'événement Socket.IO :
 *
 *   'pack:availability'  { pack_id, node_id, is_available, previous_is_available, is_active,
 *                          is_deleted, is_backorderable, assemblable_count, max_pack_qty,
 *                          sold_count, remaining_cap, availability_updated_at, source }
 *
 * à tous les clients connectés, et à la room `node:<node_id>` si les clients s'y abonnent.
 *
 * Usage (server.js) :  require('./socket/packAvailability.listener').init(io);
 * Dépendance : le paquet `pg` doit être installé. S'il est absent, le module se désactive
 * proprement (log d'avertissement, aucune exception).
 */

const CHANNEL = 'pack_availability';
const EVENT   = 'pack:availability';

let _client = null;
let _stopped = false;
let _retryMs = 1000;
let _timer = null;

function loadPg() {
  try {
    // eslint-disable-next-line global-require
    return require('pg');
  } catch {
    return null;
  }
}

/** Retire les paramètres propres à Prisma (?schema=…, connection_limit…) de l'URL. */
function pgConnectionString(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    for (const k of ['schema', 'connection_limit', 'pool_timeout', 'pgbouncer', 'statement_cache_size', 'socket_timeout']) {
      u.searchParams.delete(k);
    }
    return u.toString();
  } catch {
    return url;
  }
}

function broadcast(io, payload) {
  if (!io) return;
  io.emit(EVENT, payload);
  if (payload?.node_id && typeof io.to === 'function') io.to(`node:${payload.node_id}`).emit(EVENT, payload);
}

async function connect(io, pg) {
  if (_stopped) return;
  const client = new pg.Client({ connectionString: pgConnectionString(process.env.DATABASE_URL) });
  _client = client;

  client.on('notification', (msg) => {
    if (msg.channel !== CHANNEL) return;
    let payload;
    try { payload = JSON.parse(msg.payload); } catch { payload = { raw: msg.payload }; }
    broadcast(io, payload);
  });

  const scheduleReconnect = (why) => {
    if (_stopped || _client !== client) return;
    _client = null;
    client.removeAllListeners();
    client.end().catch(() => {});
    console.warn(`[pack-availability] connexion LISTEN perdue (${why}) — nouvel essai dans ${_retryMs} ms`);
    _timer = setTimeout(() => connect(io, pg), _retryMs);
    _retryMs = Math.min(_retryMs * 2, 30000);
  };
  client.on('error', (e) => scheduleReconnect(e.message));
  client.on('end', () => scheduleReconnect('fin de connexion'));

  try {
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    _retryMs = 1000;
    console.log(`[pack-availability] LISTEN ${CHANNEL} → Socket.IO '${EVENT}'`);
  } catch (e) {
    scheduleReconnect(e.message);
  }
}

/**
 * @param {import('socket.io').Server} io  instance (ou namespace) Socket.IO sur laquelle diffuser
 * @returns {{ enabled: boolean, stop: () => Promise<void> }}
 */
function init(io) {
  const pg = loadPg();
  if (!pg) {
    console.warn("[pack-availability] paquet 'pg' absent : diffusion temps réel des packs désactivée (npm i pg).");
    return { enabled: false, stop: async () => {} };
  }
  if (!process.env.DATABASE_URL) {
    console.warn('[pack-availability] DATABASE_URL absente : diffusion temps réel des packs désactivée.');
    return { enabled: false, stop: async () => {} };
  }
  _stopped = false;
  connect(io, pg);
  return { enabled: true, stop };
}

async function stop() {
  _stopped = true;
  if (_timer) clearTimeout(_timer);
  const c = _client;
  _client = null;
  if (c) {
    c.removeAllListeners();
    await c.end().catch(() => {});
  }
}

module.exports = { init, stop, CHANNEL, EVENT };
