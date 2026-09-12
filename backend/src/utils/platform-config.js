const prisma = require('../config/database');

/**
 * Paramètres globaux de la plateforme (app_configs, liste fermée — WF #41).
 *
 * Le classeur impose que le premier jour de la semaine soit configurable et
 * serve de base à TOUS les quotas et agrégats hebdomadaires (US-118) : jeux,
 * codes promo, rapports. PostgreSQL `date_trunc('week', …)` étant figé au
 * lundi (semaine ISO), la borne est recalculée ici à partir de la clé.
 *
 * Les valeurs sont mises en cache 60 s : elles changent rarement et sont lues
 * sur des chemins chauds (moteur de jeu, reporting).
 */

const TTL_MS = 60_000;

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DEFAULTS = {
  week_start_day: 'monday',
  default_timezone: 'Africa/Casablanca',
  default_currency: 'MAD',
  support_phone: '',
  support_whatsapp: '',
  cgu_url: '',
  privacy_url: '',
};

let cache = null;
let cachedAt = 0;

async function all() {
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;
  try {
    const rows = await prisma.appConfig.findMany({ select: { config_key: true, config_value: true } });
    cache = { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.config_key, r.config_value])) };
  } catch {
    cache = cache || { ...DEFAULTS };
  }
  cachedAt = Date.now();
  return cache;
}

/** À appeler après une écriture de configuration pour que l'effet soit immédiat. */
function invalidate() {
  cache = null;
  cachedAt = 0;
}

async function get(key, fallback = null) {
  const cfg = await all();
  return cfg[key] ?? fallback;
}

/** Premier jour de la semaine, en numéro PostgreSQL DOW (0 = dimanche). */
async function weekStartDow() {
  const code = String(await get('week_start_day', 'monday')).trim().toLowerCase();
  const i = DAYS.indexOf(code);
  return i === -1 ? 1 : i;
}

async function timezone() {
  return String(await get('default_timezone', 'Africa/Casablanca'));
}

module.exports = { all, get, invalidate, weekStartDow, timezone, DAYS, DEFAULTS };
