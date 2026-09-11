/**
 * Gamification — règles métier PURES (sans accès base), partagées par le
 * back-office (configuration des jeux / lots) et le moteur de jeu.
 *
 * Références classeur : US-079, US-080, US-081, US-082 ; WF #9, #15, #36 ;
 * feuille « Gamification - Déblocage » (conditions, périodes, 18 cas T01–T18).
 */

const TZ = 'Africa/Casablanca';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bad = (message, statusCode = 400) => ({ statusCode, message });

/**
 * Matrice condition × période × quota × seuil (US-079 section B).
 *  - periods        : périodes de reset autorisées
 *  - fixedMaxPlays  : quota imposé (null = libre ≥ 1)
 *  - minAmount      : le champ « Montant minimum » est-il applicable ?
 *  - needsOrder     : la participation est-elle adossée à une commande ?
 */
const CONDITION_RULES = {
  first_order: { periods: ['lifetime'], fixedMaxPlays: 1, minAmount: false, needsOrder: true },
  order_delivered: { periods: ['lifetime', 'daily', 'weekly', 'monthly'], fixedMaxPlays: null, minAmount: true, needsOrder: true },
  signup: { periods: ['lifetime'], fixedMaxPlays: 1, minAmount: false, needsOrder: false },
  app_login: { periods: ['daily', 'weekly', 'monthly'], fixedMaxPlays: 1, minAmount: false, needsOrder: false },
};

const MAX_PLAYS_LIMIT = 100; // garde-fou (colonne SMALLINT)
const PRIZE_TYPES = ['points', 'coupon', 'free_sku', 'free_pack', 'no_prize'];
const COUPON_PROMO_TYPES = ['PERCENTAGE', 'FIXED'];

// Champs de « règles » figés dès qu'une partie a été jouée (US-080 A).
const FROZEN_GAME_FIELDS = {
  game_type_id: 'Type de jeu',
  node_id: 'Node',
  unlock_condition_id: 'Condition de déblocage',
  play_period_id: 'Période de reset',
  max_plays_per_user: 'Nb de parties max par client',
  unlock_min_amount: 'Montant minimum',
  starts_at: 'Date de début',
};

// Champs d'un lot verrouillés dès la première attribution (US-080 D, US-081).
// Restent modifiables : probability_weight, stock_limit, is_active, sort_order.
const LOCKED_PRIZE_FIELDS = {
  prize_type_id: 'Type de lot',
  name_fr: 'Nom FR',
  name_ar: 'Nom AR',
  value: 'Valeur',
  sku_id: 'SKU',
  pack_id: 'Pack',
  coupon_code_prefix: 'Préfixe du code',
  coupon_promo_type_id: 'Type de promo',
  coupon_min_order_amount: 'Montant minimum de commande',
  coupon_validity_days: 'Durée de validité',
};

// ─── petits parseurs ──────────────────────────────────────────────────────

const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

function str(v, label, { required = false, max = 255 } = {}) {
  if (isBlank(v)) {
    if (required) throw bad(`${label} est obligatoire`);
    return null;
  }
  const s = String(v).trim();
  if (s.length > max) throw bad(`${label} : ${max} caractères maximum`);
  return s;
}

function uuid(v, label, { required = false } = {}) {
  if (isBlank(v)) {
    if (required) throw bad(`${label} est obligatoire`);
    return null;
  }
  const s = String(v).trim();
  if (!UUID_RE.test(s)) throw bad(`${label} : identifiant invalide`);
  return s;
}

function num(v, label, { required = false, min = null, gt = null, max = null, integer = false } = {}) {
  if (isBlank(v)) {
    if (required) throw bad(`${label} est obligatoire`);
    return null;
  }
  const n = Number(typeof v === 'string' ? v.replace(',', '.') : v);
  if (!Number.isFinite(n)) throw bad(`${label} doit être un nombre`);
  if (integer && !Number.isInteger(n)) throw bad(`${label} doit être un nombre entier`);
  if (min !== null && n < min) throw bad(`${label} doit être supérieur ou égal à ${min}`);
  if (gt !== null && n <= gt) throw bad(`${label} doit être strictement supérieur à ${gt}`);
  if (max !== null && n > max) throw bad(`${label} doit être inférieur ou égal à ${max}`);
  return n;
}

function date(v, label, { required = false } = {}) {
  if (isBlank(v)) {
    if (required) throw bad(`${label} est obligatoire`);
    return null;
  }
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) throw bad(`${label} : date invalide`);
  return d;
}

function bool(v, def) {
  if (v === undefined || v === null || v === '') return def;
  if (typeof v === 'boolean') return v;
  return ['true', '1', 'on', 'yes'].includes(String(v).toLowerCase());
}

const toNumOrNull = (v) => (v === null || v === undefined ? null : Number(v));

/** Résout une valeur de référentiel (id UUID ou code) dans une liste {id, code}. */
function resolveLookup(list, value, label, { required = true } = {}) {
  if (isBlank(value)) {
    if (required) throw bad(`${label} est obligatoire`);
    return null;
  }
  const v = String(value).trim();
  const row = list.find((r) => r.id === v || r.code === v);
  if (!row) throw bad(`${label} : valeur inconnue (${v})`);
  return row;
}

// ─── règles du jeu (US-079 / US-080) ─────────────────────────────────────

/**
 * Normalise et valide le payload d'un jeu (champs de règles + identité).
 * @param {object} body
 * @param {object} lk   référentiels { gameTypes, periods, conditions } (listes {id, code, name_fr})
 * @returns {{ data: object, codes: { condition, period, game_type } }}
 */
function normalizeGame(body, lk) {
  const node_id = uuid(body.node_id, 'Node', { required: true });
  const gameType = resolveLookup(lk.gameTypes, body.game_type_id ?? body.game_type, 'Type de jeu');
  const name_fr = str(body.name_fr, 'Nom FR', { required: true });
  const name_ar = str(body.name_ar, 'Nom AR', { required: true });
  const condition = resolveLookup(lk.conditions, body.unlock_condition_id ?? body.unlock_condition, 'Condition de déblocage');
  const period = resolveLookup(lk.periods, body.play_period_id ?? body.play_period, 'Période de reset');
  const starts_at = date(body.starts_at, 'Date de début', { required: true });
  const ends_at = date(body.ends_at, 'Date de fin');
  if (ends_at && ends_at <= starts_at) throw bad('La date de fin doit être postérieure à la date de début');

  const rule = CONDITION_RULES[condition.code];
  if (!rule) throw bad(`Condition de déblocage non prise en charge (${condition.code})`);

  // Combinaison interdite app_login + lifetime (US-079 D, cas T18).
  if (condition.code === 'app_login' && period.code === 'lifetime') {
    throw bad(
      'Combinaison interdite : la condition « Connexion à l’app » (app_login) ne peut pas être associée à la période « À vie » (lifetime), '
      + 'qui ferait doublon avec l’inscription (signup). Choisissez Quotidien, Hebdomadaire ou Mensuel.'
    );
  }
  if (!rule.periods.includes(period.code)) {
    throw bad(`Période incohérente : la condition « ${condition.name_fr || condition.code} » n'accepte que la période ${rule.periods.join(' | ')}.`);
  }

  // Quota : forcé à 1 hors order_delivered ; libre ≥ 1 sinon.
  let max_plays_per_user;
  if (rule.fixedMaxPlays !== null) {
    const asked = num(body.max_plays_per_user, 'Nb de parties max par client', { integer: true });
    if (asked !== null && asked < 1) throw bad('Nb de parties max par client doit être supérieur ou égal à 1');
    max_plays_per_user = rule.fixedMaxPlays;
  } else {
    max_plays_per_user = num(isBlank(body.max_plays_per_user) ? 1 : body.max_plays_per_user, 'Nb de parties max par client', {
      required: true, integer: true, min: 1, max: MAX_PLAYS_LIMIT,
    });
  }

  // Seuil : uniquement order_delivered, facultatif, ≥ 0 ; NULL pour les autres conditions.
  let unlock_min_amount = null;
  if (rule.minAmount) {
    unlock_min_amount = num(body.unlock_min_amount, 'Montant minimum', { min: 0, max: 9999999999.99 });
    if (unlock_min_amount !== null) unlock_min_amount = Math.round(unlock_min_amount * 100) / 100;
  } else if (!isBlank(body.unlock_min_amount)) {
    throw bad(`Le montant minimum ne s'applique qu'à la condition « Commande livrée » (order_delivered) : laissez-le vide pour « ${condition.name_fr || condition.code} ».`);
  }

  return {
    data: {
      node_id,
      game_type_id: gameType.id,
      name_fr,
      name_ar,
      unlock_condition_id: condition.id,
      play_period_id: period.id,
      max_plays_per_user,
      unlock_min_amount,
      starts_at,
      ends_at,
    },
    codes: { condition: condition.code, period: period.code, game_type: gameType.code },
  };
}

/** Compare deux valeurs de champ (dates, décimaux Prisma, nombres, null). */
function sameValue(a, b) {
  const nil = (v) => v === null || v === undefined;
  if (nil(a) || nil(b)) return nil(a) && nil(b);
  if (a instanceof Date || b instanceof Date) return new Date(a).getTime() === new Date(b).getTime();
  const na = Number(typeof a === 'object' ? a.toString() : a);
  const nb = Number(typeof b === 'object' ? b.toString() : b);
  if ((typeof a !== 'string' || typeof b !== 'string') && Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return String(a) === String(b);
}

/** Libellés des champs figés qui seraient modifiés (US-080 A). */
function changedFrozenFields(existing, next) {
  return Object.entries(FROZEN_GAME_FIELDS)
    .filter(([k]) => !sameValue(existing[k], next[k]))
    .map(([, label]) => label);
}

// ─── lots (US-081) ───────────────────────────────────────────────────────

/**
 * Normalise un lot selon son type. Les champs non applicables sont remis à
 * NULL (colonnes NOT NULL coupon_min_order_amount / coupon_validity_days :
 * valeurs par défaut du schéma 0 / 30).
 * @param {object} body
 * @param {object} lk { prizeTypes, promoTypes }
 */
function normalizePrize(body, lk) {
  const prizeType = resolveLookup(lk.prizeTypes, body.prize_type_id ?? body.prize_type, 'Type de lot');
  const code = prizeType.code;
  if (!PRIZE_TYPES.includes(code)) throw bad(`Type de lot non pris en charge (${code})`);

  const data = {
    prize_type_id: prizeType.id,
    name_fr: str(body.name_fr, 'Nom FR du lot', { required: true, max: 150 }),
    name_ar: str(body.name_ar, 'Nom AR du lot', { required: true, max: 150 }),
    probability_weight: num(body.probability_weight, 'Poids de probabilité', { required: true, gt: 0, max: 9999.9999 }),
    stock_limit: num(body.stock_limit, 'Stock max', { integer: true, min: 1, max: 2147483647 }),
    sort_order: num(isBlank(body.sort_order) ? 0 : body.sort_order, "Ordre d'affichage", { integer: true, min: 0, max: 32767 }),
    is_active: bool(body.is_active, true),
    value: null,
    sku_id: null,
    pack_id: null,
    coupon_code_prefix: null,
    coupon_promo_type_id: null,
    coupon_min_order_amount: 0,
    coupon_validity_days: 30,
  };
  data.probability_weight = Math.round(data.probability_weight * 10000) / 10000;

  if (code === 'points') {
    data.value = num(body.value, 'Nombre de points', { required: true, integer: true, gt: 0, max: 1000000 });
  } else if (code === 'coupon') {
    const prefix = str(body.coupon_code_prefix, 'Préfixe du code promo', { required: true, max: 20 }).toUpperCase();
    if (!/^[A-Z0-9_-]{2,20}$/.test(prefix)) {
      throw bad('Préfixe du code promo : 2 à 20 caractères (lettres, chiffres, - ou _)');
    }
    const promoType = resolveLookup(lk.promoTypes, body.coupon_promo_type_id ?? body.coupon_promo_type, 'Type de promo du coupon');
    if (!COUPON_PROMO_TYPES.includes(promoType.code)) {
      throw bad('Type de promo du coupon : pourcentage (PERCENTAGE) ou montant fixe (FIXED) uniquement');
    }
    const value = num(body.value, 'Valeur du coupon', {
      required: true, gt: 0, max: promoType.code === 'PERCENTAGE' ? 100 : 9999999999.99,
    });
    data.coupon_code_prefix = prefix;
    data.coupon_promo_type_id = promoType.id;
    data.value = Math.round(value * 100) / 100;
    data.coupon_min_order_amount = num(isBlank(body.coupon_min_order_amount) ? 0 : body.coupon_min_order_amount,
      'Montant minimum de commande du coupon', { min: 0, max: 9999999999.99 });
    data.coupon_validity_days = num(isBlank(body.coupon_validity_days) ? 30 : body.coupon_validity_days,
      'Durée de validité du coupon (jours)', { integer: true, gt: 0, max: 3650 });
  } else if (code === 'free_sku') {
    data.sku_id = uuid(body.sku_id, 'SKU offert', { required: true });
  } else if (code === 'free_pack') {
    data.pack_id = uuid(body.pack_id, 'Pack offert', { required: true });
  }
  // no_prize : aucun champ de valeur, pas de plafond.
  if (code === 'no_prize') data.stock_limit = null;

  return { data, code };
}

/** Libellés des champs verrouillés d'un lot déjà attribué qui seraient modifiés. */
function changedLockedPrizeFields(existing, next) {
  return Object.entries(LOCKED_PRIZE_FIELDS)
    .filter(([k]) => !sameValue(existing[k], next[k]))
    .map(([, label]) => label);
}

/** Un lot a-t-il atteint son plafond ? */
const isExhausted = (p) => p.stock_limit !== null && p.stock_limit !== undefined
  && Number(p.awarded_count || 0) >= Number(p.stock_limit);

/**
 * Contrôles « avant enregistrement » portant sur l'ensemble des lots d'un jeu
 * (US-079 E). Contrôles 1, 2 et 4 BLOQUANTS ; contrôle 5 = avertissement.
 * @param {Array} prizes  lots enrichis { prize_type_code, is_active, probability_weight, pack_id, pack_node_id, sku_id, sku_stock, name_fr, ... }
 * @param {object} game   { node_id }
 * @returns {{ errors: string[], warnings: string[] }}
 */
function checkPrizeSet(prizes, game) {
  const errors = [];
  const warnings = [];
  const active = prizes.filter((p) => p.is_active);
  if (!active.some((p) => p.prize_type_code !== 'no_prize')) {
    errors.push('Au moins un lot actif hors « Aucun gain » (no_prize) est requis.');
  }
  const sum = active.reduce((s, p) => s + Number(p.probability_weight || 0), 0);
  if (!(sum > 0)) {
    errors.push('La somme des poids de probabilité des lots actifs doit être strictement positive.');
  }
  for (const p of prizes) {
    if (p.prize_type_code === 'free_pack' && p.pack_id && p.pack_node_id !== game.node_id) {
      errors.push(`Le lot « ${p.name_fr} » référence un pack qui n'appartient pas au node du jeu.`);
    }
    if (p.prize_type_code === 'free_sku' && p.sku_id && !(Number(p.sku_stock || 0) > 0)) {
      warnings.push(`Lot « ${p.name_fr} » : le SKU offert n'a pas de stock disponible sur le node du jeu (avertissement non bloquant).`);
    }
    if (p.is_active && isExhausted(p)) {
      warnings.push(`Lot « ${p.name_fr} » : stock max atteint, le lot sort du tirage.`);
    }
  }
  if (prizes.length > 0 && !prizes.some((p) => p.prize_type_code === 'no_prize')) {
    warnings.push('Aucun lot « Aucun gain » (no_prize) : recommandé avec un poids élevé pour équilibrer le jeu.');
  }
  return { errors, warnings };
}

/** Ajoute probability_pct (poids normalisé en %, lots actifs uniquement). */
function withNormalizedWeights(prizes) {
  const sum = prizes.filter((p) => p.is_active).reduce((s, p) => s + Number(p.probability_weight || 0), 0);
  return prizes.map((p) => ({
    ...p,
    probability_pct: p.is_active && sum > 0 ? Math.round((Number(p.probability_weight) / sum) * 10000) / 100 : 0,
  }));
}

// ─── déblocage (feuille « Gamification - Déblocage », cas T01–T18) ───────

/**
 * Évalue si une participation est accordée à partir des faits constatés.
 * Réplique les colonnes calculées J (« Condition remplie ? ») et K
 * (« Participation accordée ? ») du tableau des 18 cas de test.
 *
 * @param {object} f
 * @param {string} f.condition        first_order | order_delivered | signup | app_login
 * @param {number|null} f.minAmount   seuil (0 / null = aucun)
 * @param {number} f.maxPlays         max_plays_per_user
 * @param {string} f.period           lifetime | daily | weekly | monthly
 * @param {number} [f.orderAmount]    montant de la commande (total_ttc)
 * @param {number} [f.orderRank]      rang de la commande du client (1 = première)
 * @param {boolean} [f.eventObserved] livraison encaissée / OTP / connexion constatés
 * @param {number} f.playsInPeriod    parties déjà jouées dans la période
 * @returns {{ conditionMet: boolean, granted: boolean, remaining: number, reason: string|null }}
 */
function evaluateUnlock(f) {
  const maxPlays = Number(f.maxPlays || 1);
  const played = Number(f.playsInPeriod || 0);
  let conditionMet = false;
  let reason = null;

  if (f.condition === 'app_login' && f.period === 'lifetime') {
    reason = 'Combinaison interdite app_login + lifetime';
  } else if (f.condition === 'order_delivered') {
    const threshold = Number(f.minAmount || 0);
    if (!f.eventObserved) reason = 'Commande non livrée ou non encaissée';
    else if (threshold > 0 && !(Number(f.orderAmount || 0) >= threshold)) reason = `Montant de la commande sous le seuil de ${threshold} MAD`;
    else conditionMet = true;
  } else if (f.condition === 'first_order') {
    if (Number(f.orderRank) === 1) conditionMet = true;
    else reason = "Ce n'est pas la première commande du client";
  } else if (f.condition === 'signup' || f.condition === 'app_login') {
    if (f.eventObserved) conditionMet = true;
    else reason = f.condition === 'signup' ? 'Numéro non vérifié par OTP' : "Aucune connexion à l'app sur la période";
  } else {
    reason = 'Condition de déblocage inconnue';
  }

  const quotaLeft = played < maxPlays;
  const granted = conditionMet && quotaLeft;
  if (conditionMet && !quotaLeft) reason = 'Quota de parties atteint sur la période';
  const remaining = Math.max(0, granted ? maxPlays - played - 1 : maxPlays - played);
  return { conditionMet, granted, remaining, reason };
}

/** Tirage pondéré sur probability_weight. */
function weightedPick(items, rng = Math.random) {
  const total = items.reduce((s, p) => s + Number(p.probability_weight || 0), 0);
  if (!(total > 0)) return null;
  let r = rng() * total;
  for (const p of items) {
    r -= Number(p.probability_weight || 0);
    if (r < 0) return p;
  }
  return items[items.length - 1];
}

/** Statut de réclamation déduit (US-082) : claimed | pending | expired | null (partie perdue). */
function claimStatus(play, now = new Date()) {
  if (play.result !== 'win' || !play.prize_id) return null;
  if (play.claimed_at) return 'claimed';
  if (play.expires_at && new Date(play.expires_at) < now) return 'expired';
  return 'pending';
}

/** Statut d'affichage d'un jeu : inactive | scheduled | running | ended. */
function gameStatus(game, now = new Date()) {
  if (game.ends_at && new Date(game.ends_at) <= now) return 'ended';
  if (!game.is_active) return 'inactive';
  if (new Date(game.starts_at) > now) return 'scheduled';
  return 'running';
}

module.exports = {
  TZ,
  UUID_RE,
  bad,
  CONDITION_RULES,
  FROZEN_GAME_FIELDS,
  LOCKED_PRIZE_FIELDS,
  COUPON_PROMO_TYPES,
  isBlank,
  uuid,
  num,
  date,
  bool,
  toNumOrNull,
  resolveLookup,
  sameValue,
  normalizeGame,
  changedFrozenFields,
  normalizePrize,
  changedLockedPrizeFields,
  isExhausted,
  checkPrizeSet,
  withNormalizedWeights,
  evaluateUnlock,
  weightedPick,
  claimStatus,
  gameStatus,
};
