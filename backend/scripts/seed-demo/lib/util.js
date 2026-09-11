/**
 * Outils communs du script de démonstration ATINA-2.
 */
const bcrypt = require('bcryptjs');

const PASSWORD = 'Test@2026';
let _hash = null;
async function passwordHash() {
  if (!_hash) _hash = await bcrypt.hash(PASSWORD, 10);
  return _hash;
}

/** PRNG déterministe (mulberry32) : mêmes données à chaque exécution. */
function rng(seed = 20260911) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (min, max) => Math.floor(next() * (max - min + 1)) + min;
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.shuffle = (arr) => {
    const a2 = [...arr];
    for (let i = a2.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [a2[i], a2[j]] = [a2[j], a2[i]];
    }
    return a2;
  };
  next.sample = (arr, n) => next.shuffle(arr).slice(0, n);
  return next;
}

/** Hash texte → entier (graine stable par clé). */
function seedOf(str) {
  let h = 2166136261;
  for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** EAN-13 avec clé de contrôle. `twelve` = 12 premiers chiffres. */
function ean13(twelve) {
  const d = String(twelve).padStart(12, '0').slice(0, 12);
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(d[i]) * (i % 2 === 0 ? 1 : 3);
  return d + ((10 - (sum % 10)) % 10);
}

const round2 = (v) => Math.round(Number(v) * 100) / 100;
const round50 = (v) => Math.round(Number(v) * 2) / 2; // arrondi à 0,50 MAD

/** Date locale (Africa/Casablanca ≈ UTC+1) : jour J-n à hh:mm. */
function daysAgo(n, hh = 10, mm = 0) {
  const d = new Date();
  d.setUTCHours(hh - 1, mm, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}
function dateOnly(d) { return new Date(d).toISOString().slice(0, 10); }
function addMinutes(d, m) { return new Date(new Date(d).getTime() + m * 60000); }
function addDays(d, n) { return new Date(new Date(d).getTime() + n * 86400000); }

/** Requête Express simulée pour les services qui attendent `req`. */
function fakeReq(userId) {
  return { user: { id: userId }, headers: { 'user-agent': 'seed-demo' }, ip: '127.0.0.1', params: {}, query: {}, body: {} };
}

function slug(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '.').replace(/^\.|\.$/g, '').toLowerCase();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { PASSWORD, passwordHash, rng, seedOf, ean13, round2, round50, daysAgo, dateOnly, addMinutes, addDays, fakeReq, slug, sleep };
