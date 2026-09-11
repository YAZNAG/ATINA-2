/**
 * Helpers communs du module Achats & Fournisseurs (suppliers, supplier_prices,
 * purchase_orders, purchase_order_items).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Statuts de BC « en cours » (bloquent la désactivation / suppression d'un fournisseur). */
const OPEN_PO_STATUSES = ['draft', 'sent', 'in_transit', 'partially_received'];

/** Transitions manuelles autorisées (la réception pilote partially_received / received). */
const PO_TRANSITIONS = {
  draft: ['sent', 'cancelled'],
  sent: ['in_transit', 'cancelled'],
  in_transit: ['cancelled'],
  partially_received: ['received'], // « Clôturer » : solde le reliquat non livré
  received: [],
  cancelled: [],
};

/** Lignes (SKU / qté / prix) modifiables. */
const LINES_EDITABLE_STATUSES = ['draft', 'sent'];
/** En-tête (date prévue, notes) modifiable. */
const HEADER_EDITABLE_STATUSES = ['draft', 'sent', 'in_transit', 'partially_received'];
/** Réception possible. */
const RECEIVABLE_STATUSES = ['sent', 'in_transit', 'partially_received'];
/** Statuts où les quantités commandées sont comptées en qty_incoming dans stock_levels. */
const INCOMING_STATUSES = ['sent', 'in_transit', 'partially_received'];

const bad = (message, statusCode = 400) => ({ statusCode, message });

const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

function assertUuid(v, label = 'Identifiant') {
  if (!isUuid(v)) throw bad(`${label} invalide`);
  return v;
}

/** Decimal Prisma / string → Number (null conservé). */
const num = (v) => (v === null || v === undefined ? null : Number(v));
const round = (v, d = 2) => {
  const f = 10 ** d;
  return Math.round((Number(v) + Number.EPSILON) * f) / f;
};

/** Texte optionnel nettoyé (chaîne vide → null). */
function optText(v, max, label) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (max && s.length > max) throw bad(`${label} : ${max} caractères maximum`);
  return s;
}

/** Date « YYYY-MM-DD » (ou ISO) → Date à minuit UTC ; '' / null → null ; undefined → undefined. */
function parseDateOnly(v, label = 'Date') {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const s = String(v).slice(0, 10);
  if (!DATE_RE.test(s)) throw bad(`${label} invalide (format attendu AAAA-MM-JJ)`);
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw bad(`${label} invalide`);
  return d;
}

/** Date du jour (fuseau serveur) à minuit UTC, pour comparer aux colonnes DATE. */
function todayDateOnly() {
  const n = new Date();
  const s = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  return new Date(`${s}T00:00:00.000Z`);
}

const addDays = (d, days) => new Date(d.getTime() + days * 86400000);

/** Date → 'YYYY-MM-DD' (colonnes DATE). */
const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

function parseNumber(v, label, { min = null, max = null, integer = false, required = false, gt = null } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) throw bad(`${label} requis`);
    return v === undefined ? undefined : null;
  }
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n)) throw bad(`${label} invalide`);
  if (integer && !Number.isInteger(n)) throw bad(`${label} doit être un entier`);
  if (min !== null && n < min) throw bad(`${label} doit être ≥ ${min}`);
  if (gt !== null && n <= gt) throw bad(`${label} doit être > ${gt}`);
  if (max !== null && n > max) throw bad(`${label} doit être ≤ ${max}`);
  return n;
}

function parseBool(v) {
  if (v === undefined) return undefined;
  return v === true || v === 'true' || v === 1 || v === '1';
}

function pagination(query = {}, defLimit = 20) {
  const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(query.limit ?? String(defLimit), 10) || defLimit));
  return { page, limit, skip: (page - 1) * limit };
}

const pageMeta = (total, page, limit) => ({ total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });

const isUniqueViolation = (err) => err && err.code === 'P2002';

module.exports = {
  OPEN_PO_STATUSES,
  PO_TRANSITIONS,
  LINES_EDITABLE_STATUSES,
  HEADER_EDITABLE_STATUSES,
  RECEIVABLE_STATUSES,
  INCOMING_STATUSES,
  bad,
  isUuid,
  assertUuid,
  num,
  round,
  optText,
  parseDateOnly,
  todayDateOnly,
  addDays,
  fmtDate,
  parseNumber,
  parseBool,
  pagination,
  pageMeta,
  isUniqueViolation,
};
