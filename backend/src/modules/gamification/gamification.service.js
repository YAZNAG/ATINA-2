/**
 * Gamification — service back-office : référentiels, jeux, lots.
 *
 * US-079 (création), US-080 (modification / désactivation / suppression),
 * US-081 (lots et probabilités). Les participations (US-082) sont dans
 * gamification.plays.service.js, le moteur de jeu dans gamification.engine.js.
 */
const prisma = require('../../config/database');
const { audit } = require('../../utils/audit');
const R = require('./gamification.rules');

const { bad } = R;
const RESOURCE_GAME = 'gamification_games';
const RESOURCE_PRIZE = 'gamification_prizes';

// ─── référentiels ─────────────────────────────────────────────────────────

let lookupCache = null;
let lookupCacheAt = 0;
const LOOKUP_TTL_MS = 5 * 60 * 1000;

const lkSelect = { id: true, code: true, name_fr: true, name_ar: true };

async function loadLookups(force = false) {
  if (!force && lookupCache && Date.now() - lookupCacheAt < LOOKUP_TTL_MS) return lookupCache;
  const [gameTypes, periods, conditions, prizeTypes, promoTypes] = await Promise.all([
    prisma.gameType.findMany({ select: lkSelect, orderBy: { code: 'asc' } }),
    prisma.gamePlayPeriod.findMany({ select: lkSelect }),
    prisma.unlockCondition.findMany({ select: lkSelect }),
    prisma.prizeType.findMany({ select: lkSelect }),
    prisma.promoType.findMany({ select: lkSelect, where: { code: { in: R.COUPON_PROMO_TYPES } } }),
  ]);
  const periodOrder = ['lifetime', 'daily', 'weekly', 'monthly'];
  const condOrder = ['first_order', 'order_delivered', 'signup', 'app_login'];
  const prizeOrder = ['points', 'coupon', 'free_sku', 'free_pack', 'no_prize'];
  const sortBy = (order) => (a, b) => order.indexOf(a.code) - order.indexOf(b.code);
  lookupCache = {
    gameTypes,
    periods: periods.sort(sortBy(periodOrder)),
    conditions: conditions.sort(sortBy(condOrder)),
    prizeTypes: prizeTypes.sort(sortBy(prizeOrder)),
    promoTypes,
  };
  lookupCacheAt = Date.now();
  return lookupCache;
}

const codeOf = (list, id) => list.find((r) => r.id === id)?.code ?? null;

/** GET /gamification/lookups */
async function getLookups() {
  const lk = await loadLookups(true);
  const nodes = await prisma.node.findMany({
    where: { is_deleted: false },
    select: { id: true, code: true, name_fr: true, name_ar: true, is_active: true, min_order_amount: true },
    orderBy: { code: 'asc' },
  });
  return {
    game_types: lk.gameTypes,
    play_periods: lk.periods,
    unlock_conditions: lk.conditions.map((c) => ({ ...c, rules: R.CONDITION_RULES[c.code] || null })),
    prize_types: lk.prizeTypes,
    coupon_promo_types: lk.promoTypes,
    nodes: nodes.map((n) => ({ ...n, min_order_amount: Number(n.min_order_amount) })),
  };
}

/** GET /gamification/nodes/:nodeId/packs — packs du node (lots free_pack). */
async function getNodePacks(nodeId) {
  const id = R.uuid(nodeId, 'Node', { required: true });
  const packs = await prisma.pack.findMany({
    where: { node_id: id, is_deleted: false },
    select: { id: true, name_fr: true, name_ar: true, total_price: true, is_active: true, is_available: true },
    orderBy: { name_fr: 'asc' },
  });
  return packs.map((p) => ({ ...p, total_price: Number(p.total_price) }));
}

/** GET /gamification/nodes/:nodeId/skus?search= — SKU + stock disponible sur le node (lots free_sku). */
async function searchNodeSkus(nodeId, { search = '', limit = 20 } = {}) {
  const id = R.uuid(nodeId, 'Node', { required: true });
  const q = String(search || '').trim();
  const where = { is_deleted: false };
  if (q) {
    where.OR = [
      { name_fr: { contains: q, mode: 'insensitive' } },
      { name_ar: { contains: q, mode: 'insensitive' } },
      { sku_code: { contains: q, mode: 'insensitive' } },
      { ean13: { contains: q } },
    ];
  }
  const skus = await prisma.sku.findMany({
    where,
    select: {
      id: true, sku_code: true, name_fr: true, name_ar: true, is_active: true,
      stock_levels: { where: { node_id: id }, select: { qty_available: true } },
    },
    orderBy: { name_fr: 'asc' },
    take: Math.min(50, Math.max(1, Number(limit) || 20)),
  });
  return skus.map(({ stock_levels: sl, ...s }) => ({ ...s, qty_available: Number(sl[0]?.qty_available ?? 0) }));
}

// ─── sérialisation ───────────────────────────────────────────────────────

function plainPrize(p) {
  if (!p) return p;
  return {
    ...p,
    value: R.toNumOrNull(p.value),
    probability_weight: Number(p.probability_weight),
    coupon_min_order_amount: Number(p.coupon_min_order_amount ?? 0),
  };
}

function plainGame(g, now = new Date()) {
  if (!g) return g;
  return {
    ...g,
    unlock_min_amount: R.toNumOrNull(g.unlock_min_amount),
    status: R.gameStatus(g, now),
  };
}

/**
 * Enrichit des lots (bruts ou normalisés) pour les contrôles et l'affichage :
 * code du type, node du pack, stock du SKU sur le node du jeu.
 */
async function enrichPrizes(prizes, nodeId, tx = prisma) {
  const lk = await loadLookups();
  const packIds = [...new Set(prizes.map((p) => p.pack_id).filter(Boolean))];
  const skuIds = [...new Set(prizes.map((p) => p.sku_id).filter(Boolean))];
  const [packs, skus, stocks] = await Promise.all([
    packIds.length
      ? tx.pack.findMany({ where: { id: { in: packIds } }, select: { id: true, node_id: true, name_fr: true, is_deleted: true } })
      : [],
    skuIds.length
      ? tx.sku.findMany({ where: { id: { in: skuIds } }, select: { id: true, sku_code: true, name_fr: true } })
      : [],
    skuIds.length && nodeId
      ? tx.stockLevel.findMany({ where: { node_id: nodeId, sku_id: { in: skuIds } }, select: { sku_id: true, qty_available: true } })
      : [],
  ]);
  return prizes.map((p) => {
    const pack = packs.find((x) => x.id === p.pack_id) || null;
    const sku = skus.find((x) => x.id === p.sku_id) || null;
    const stock = stocks.find((x) => x.sku_id === p.sku_id);
    return {
      ...plainPrize(p),
      prize_type_code: codeOf(lk.prizeTypes, p.prize_type_id),
      pack_node_id: pack?.node_id ?? null,
      pack_label: pack?.name_fr ?? null,
      sku_label: sku ? `${sku.sku_code} — ${sku.name_fr}` : null,
      sku_stock: p.sku_id ? Number(stock?.qty_available ?? 0) : null,
    };
  });
}

// ─── lectures ────────────────────────────────────────────────────────────

const gameInclude = {
  node: { select: { id: true, code: true, name_fr: true, name_ar: true, min_order_amount: true } },
  game_type: { select: lkSelect },
  play_period: { select: lkSelect },
  unlock_condition: { select: lkSelect },
  creator: { select: { id: true, full_name: true, email: true } },
};

async function findGameOr404(id, tx = prisma) {
  const gid = R.uuid(id, 'Jeu', { required: true });
  const game = await tx.gamificationGame.findFirst({ where: { id: gid, is_deleted: false } });
  if (!game) throw bad('Jeu introuvable', 404);
  return game;
}

/** GET /gamification/games — filtres node_id, game_type_id, play_period_id, unlock_condition_id, status, search. */
async function listGames(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 25));
  const now = new Date();
  const where = { is_deleted: false };
  if (query.node_id) where.node_id = R.uuid(query.node_id, 'Node');
  if (query.game_type_id) where.game_type_id = R.uuid(query.game_type_id, 'Type de jeu');
  if (query.play_period_id) where.play_period_id = R.uuid(query.play_period_id, 'Période');
  if (query.unlock_condition_id) where.unlock_condition_id = R.uuid(query.unlock_condition_id, 'Condition');
  if (query.is_active === 'true' || query.is_active === 'false') where.is_active = query.is_active === 'true';
  const and = [];
  switch (query.status) {
    case 'active': where.is_active = true; break;
    case 'inactive': where.is_active = false; break;
    case 'running':
      where.is_active = true;
      and.push({ starts_at: { lte: now } }, { OR: [{ ends_at: null }, { ends_at: { gt: now } }] });
      break;
    case 'scheduled': where.is_active = true; and.push({ starts_at: { gt: now } }); break;
    case 'ended': and.push({ ends_at: { lte: now } }); break;
    default: break;
  }
  if (query.search && String(query.search).trim()) {
    const s = String(query.search).trim();
    and.push({ OR: [{ name_fr: { contains: s, mode: 'insensitive' } }, { name_ar: { contains: s, mode: 'insensitive' } }] });
  }
  if (and.length) where.AND = and;

  const [total, rows] = await Promise.all([
    prisma.gamificationGame.count({ where }),
    prisma.gamificationGame.findMany({
      where,
      include: {
        ...gameInclude,
        _count: { select: { plays: true, prizes: { where: { is_deleted: false } } } },
        prizes: { where: { is_deleted: false }, select: { is_active: true, prize_type_id: true } },
      },
      orderBy: [{ created_at: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  const lk = await loadLookups();
  const data = rows.map(({ prizes, _count, ...g }) => ({
    ...plainGame(g, now),
    node: g.node ? { ...g.node, min_order_amount: Number(g.node.min_order_amount) } : null,
    prizes_count: _count.prizes,
    active_winning_prizes_count: prizes.filter((p) => p.is_active && codeOf(lk.prizeTypes, p.prize_type_id) !== 'no_prize').length,
    plays_count: _count.plays,
  }));
  return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
}

/** Compteurs de verrouillage (US-080 C) : commandes actives liées et lots gagnés non réclamés. */
async function getDeleteLocks(gameId, tx = prisma) {
  const [ordersRow] = await tx.$queryRaw`
    SELECT COUNT(DISTINCT o.id)::int AS n
      FROM order_items oi
      JOIN gamification_plays gp ON gp.id = oi.game_play_id
      JOIN orders o             ON o.id = oi.order_id
      JOIN order_statuses os    ON os.id = o.status_id
     WHERE gp.game_id = ${gameId}::uuid
       AND o.is_deleted = false
       AND os.is_terminal = false`;
  const unclaimed = await tx.gamificationPlay.count({
    where: {
      game_id: gameId,
      prize_id: { not: null },
      claimed_at: null,
      OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
    },
  });
  return { active_orders: Number(ordersRow?.n ?? 0), unclaimed_prizes: unclaimed };
}

/** GET /gamification/games/:id — jeu + lots (poids normalisés) + compteurs + contrôles. */
async function getGame(id) {
  const base = await findGameOr404(id);
  const game = await prisma.gamificationGame.findUnique({
    where: { id: base.id },
    include: {
      ...gameInclude,
      prizes: {
        where: { is_deleted: false },
        include: { prize_type: { select: lkSelect }, coupon_promo_type: { select: lkSelect } },
        orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }],
      },
    },
  });
  const [playsCount, winsCount, locks] = await Promise.all([
    prisma.gamificationPlay.count({ where: { game_id: game.id } }),
    prisma.gamificationPlay.count({ where: { game_id: game.id, result: 'win' } }),
    getDeleteLocks(game.id),
  ]);
  const prizesWithPlays = await prisma.gamificationPlay.groupBy({
    by: ['prize_id'], where: { game_id: game.id, prize_id: { not: null } }, _count: { _all: true },
  });
  const enriched = await enrichPrizes(game.prizes, game.node_id);
  const checks = R.checkPrizeSet(enriched, game);
  const prizes = R.withNormalizedWeights(enriched).map((p) => {
    const plays = prizesWithPlays.find((x) => x.prize_id === p.id)?._count._all ?? 0;
    return { ...p, plays_count: plays, is_locked: Number(p.awarded_count) > 0 || plays > 0, is_exhausted: R.isExhausted(p) };
  });
  const { prizes: _omit, ...rest } = game;
  return {
    ...plainGame(rest),
    node: game.node ? { ...game.node, min_order_amount: Number(game.node.min_order_amount) } : null,
    prizes,
    stats: { plays_count: playsCount, wins_count: winsCount, losses_count: playsCount - winsCount },
    rules_locked: playsCount > 0,
    delete_locks: locks,
    checks,
  };
}

// ─── validation commune jeu + lots ───────────────────────────────────────

async function assertNode(nodeId, tx = prisma) {
  const node = await tx.node.findFirst({ where: { id: nodeId, is_deleted: false }, select: { id: true, min_order_amount: true } });
  if (!node) throw bad('Node introuvable');
  return node;
}

/** Contrôles de référence d'un lot (SKU / pack existants, pack du node du jeu). */
async function assertPrizeRefs(data, code, nodeId, tx = prisma) {
  if (code === 'free_sku') {
    const sku = await tx.sku.findFirst({ where: { id: data.sku_id, is_deleted: false }, select: { id: true } });
    if (!sku) throw bad('SKU offert introuvable');
  }
  if (code === 'free_pack') {
    const pack = await tx.pack.findFirst({ where: { id: data.pack_id, is_deleted: false }, select: { id: true, node_id: true } });
    if (!pack) throw bad('Pack offert introuvable');
    if (pack.node_id !== nodeId) throw bad('Le pack offert doit appartenir au node du jeu (packs.node_id = node du jeu).');
  }
}

/** Plafond : cohérence stock_limit / awarded_count ; désactivation automatique à la limite. */
function applyStockLimit(data, awardedCount, warnings) {
  if (data.stock_limit !== null && data.stock_limit < awardedCount) {
    throw bad(`Le stock max (${data.stock_limit}) ne peut pas être inférieur au nombre de lots déjà attribués (${awardedCount}).`);
  }
  if (data.is_active && data.stock_limit !== null && awardedCount >= data.stock_limit) {
    data.is_active = false;
    warnings.push(`Lot « ${data.name_fr} » : stock max atteint (${awardedCount}/${data.stock_limit}), le lot est désactivé automatiquement.`);
  }
}

/** Contrôle de l'ensemble des lots ; lève une erreur si un contrôle bloquant échoue. */
async function assertPrizeSet(prizes, game, tx = prisma, prefix = '') {
  const enriched = await enrichPrizes(prizes, game.node_id, tx);
  const { errors, warnings } = R.checkPrizeSet(enriched, game);
  if (errors.length) throw bad(`${prefix}${errors.join(' ')}`);
  return warnings;
}

/** Avertissement : seuil de déblocage inférieur au minimum de commande du node. */
function thresholdWarning(data, node) {
  const min = Number(node?.min_order_amount ?? 0);
  if (data.unlock_min_amount !== null && data.unlock_min_amount > 0 && min > 0 && data.unlock_min_amount < min) {
    return [`Le montant minimum du jeu (${data.unlock_min_amount} MAD) est inférieur au minimum de commande du node (${min} MAD) : il est sans effet.`];
  }
  return [];
}

// ─── jeux : écritures ────────────────────────────────────────────────────

/**
 * POST /gamification/games — le jeu est créé INACTIF (US-079 F) avec ses lots.
 * body = champs du jeu + prizes: [ … ]
 */
async function createGame(req, body = {}) {
  const lk = await loadLookups();
  const { data } = R.normalizeGame(body, lk);
  const node = await assertNode(data.node_id);
  const rawPrizes = Array.isArray(body.prizes) ? body.prizes : [];
  if (rawPrizes.length === 0) throw bad('Configurez au moins un lot (onglet « Lots ») avant d’enregistrer le jeu.');

  const warnings = thresholdWarning(data, node);
  const prizes = [];
  for (let i = 0; i < rawPrizes.length; i += 1) {
    let norm;
    try {
      norm = R.normalizePrize(rawPrizes[i], lk);
    } catch (e) {
      throw bad(`Lot n°${i + 1} : ${e.message}`);
    }
    await assertPrizeRefs(norm.data, norm.code, data.node_id);
    applyStockLimit(norm.data, 0, warnings);
    prizes.push(norm.data);
  }
  warnings.push(...await assertPrizeSet(prizes, data));

  const created = await prisma.$transaction(async (tx) => {
    const game = await tx.gamificationGame.create({
      data: { ...data, is_active: false, created_by: req.user.id },
    });
    for (const p of prizes) {
      await tx.gamificationPrize.create({ data: { ...p, game_id: game.id } });
    }
    await audit(req, {
      action: 'CREATE',
      resource: RESOURCE_GAME,
      resource_id: game.id,
      new_values: { ...data, is_active: false, created_by: req.user.id, prizes },
    }, tx);
    return game;
  });
  return { game: await getGame(created.id), warnings };
}

/** Valeurs actuelles d'un jeu, au format du payload (pour fusion avec un PUT partiel). */
function gameToPayload(g) {
  return {
    node_id: g.node_id,
    game_type_id: g.game_type_id,
    name_fr: g.name_fr,
    name_ar: g.name_ar,
    unlock_condition_id: g.unlock_condition_id,
    play_period_id: g.play_period_id,
    max_plays_per_user: g.max_plays_per_user,
    unlock_min_amount: R.toNumOrNull(g.unlock_min_amount),
    starts_at: g.starts_at,
    ends_at: g.ends_at,
  };
}

/**
 * PUT /gamification/games/:id — contrôles de la création rejoués ; champs de
 * règles figés dès qu'une partie a été jouée (US-080 A). is_active passe par
 * les actions dédiées activate / deactivate.
 */
async function updateGame(req, id, body = {}) {
  const existing = await findGameOr404(id);
  const lk = await loadLookups();
  const current = gameToPayload(existing);
  const merged = { ...current };
  for (const k of Object.keys(current)) {
    if (Object.prototype.hasOwnProperty.call(body, k)) merged[k] = body[k];
  }
  // Si la condition change et que le seuil n'est pas fourni, on ne recopie pas l'ancien seuil.
  if (!Object.prototype.hasOwnProperty.call(body, 'unlock_min_amount') && merged.unlock_condition_id !== current.unlock_condition_id) {
    merged.unlock_min_amount = null;
  }
  const { data } = R.normalizeGame(merged, lk);

  const playsCount = await prisma.gamificationPlay.count({ where: { game_id: existing.id } });
  if (playsCount > 0) {
    const changed = R.changedFrozenFields(current, data);
    if (changed.length) {
      throw bad(`${playsCount} partie(s) déjà jouée(s) : les règles du jeu sont figées (${changed.join(', ')}). Seuls le nom, la date de fin et l'activation restent modifiables.`, 409);
    }
  }
  const node = await assertNode(data.node_id);
  const prizes = await prisma.gamificationPrize.findMany({ where: { game_id: existing.id, is_deleted: false } });
  const warnings = [...thresholdWarning(data, node), ...await assertPrizeSet(prizes, data)];

  const diffOld = {};
  const diffNew = {};
  for (const k of Object.keys(data)) {
    if (!R.sameValue(current[k], data[k])) {
      diffOld[k] = current[k];
      diffNew[k] = data[k];
    }
  }
  await prisma.$transaction(async (tx) => {
    await tx.gamificationGame.update({ where: { id: existing.id }, data });
    if (Object.keys(diffNew).length) {
      await audit(req, { action: 'UPDATE', resource: RESOURCE_GAME, resource_id: existing.id, old_values: diffOld, new_values: diffNew }, tx);
    }
  });
  return { game: await getGame(existing.id), warnings };
}

/** POST /gamification/games/:id/activate — action explicite, tous les contrôles rejoués. */
async function activateGame(req, id) {
  const existing = await findGameOr404(id);
  if (existing.is_active) return { game: await getGame(existing.id), warnings: [] };
  const lk = await loadLookups();
  const { data } = R.normalizeGame(gameToPayload(existing), lk);
  if (existing.ends_at && new Date(existing.ends_at) <= new Date()) {
    throw bad('La date de fin du jeu est dépassée : modifiez la date de fin avant de l’activer.');
  }
  const node = await assertNode(data.node_id);
  const prizes = await prisma.gamificationPrize.findMany({ where: { game_id: existing.id, is_deleted: false } });
  const warnings = [...thresholdWarning(data, node), ...await assertPrizeSet(prizes, data, prisma, 'Activation impossible : ')];
  if (new Date(existing.starts_at) > new Date()) {
    warnings.push('Le jeu sera visible dans l’app à partir de sa date de début.');
  }
  await prisma.$transaction(async (tx) => {
    await tx.gamificationGame.update({ where: { id: existing.id }, data: { is_active: true } });
    await audit(req, { action: 'ACTIVATE', resource: RESOURCE_GAME, resource_id: existing.id, old_values: { is_active: false }, new_values: { is_active: true } }, tx);
  });
  return { game: await getGame(existing.id), warnings };
}

/** POST /gamification/games/:id/deactivate — toujours autorisé (US-080 B). */
async function deactivateGame(req, id) {
  const existing = await findGameOr404(id);
  if (existing.is_active) {
    await prisma.$transaction(async (tx) => {
      await tx.gamificationGame.update({ where: { id: existing.id }, data: { is_active: false } });
      await audit(req, { action: 'DEACTIVATE', resource: RESOURCE_GAME, resource_id: existing.id, old_values: { is_active: true }, new_values: { is_active: false } }, tx);
    });
  }
  return { game: await getGame(existing.id), warnings: [] };
}

/** GET /gamification/games/:id/delete-check */
async function deleteCheck(id) {
  const existing = await findGameOr404(id);
  const locks = await getDeleteLocks(existing.id);
  return { ...locks, can_delete: locks.active_orders === 0 && locks.unclaimed_prizes === 0 };
}

/**
 * DELETE /gamification/games/:id — soft-delete, refusé si l'un des deux verrous
 * est actif (US-080 C). L'erreur 409 porte `details` (verrous + « Désactiver à la place »).
 */
async function deleteGame(req, id) {
  const existing = await findGameOr404(id);
  const locks = await getDeleteLocks(existing.id);
  if (locks.active_orders > 0 || locks.unclaimed_prizes > 0) {
    const reasons = [];
    if (locks.active_orders > 0) reasons.push(`${locks.active_orders} commande(s) active(s) contiennent un lot gagné de ce jeu`);
    if (locks.unclaimed_prizes > 0) reasons.push(`${locks.unclaimed_prizes} lot(s) gagné(s) ni réclamé(s) ni expiré(s)`);
    await audit(req, { action: 'DELETE_REFUSED', resource: RESOURCE_GAME, resource_id: existing.id, new_values: locks });
    const err = bad(`Suppression refusée : ${reasons.join(' ; ')}. Vous pouvez désactiver le jeu à la place.`, 409);
    err.details = { ...locks, can_deactivate: existing.is_active };
    throw err;
  }
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.gamificationGame.update({ where: { id: existing.id }, data: { is_deleted: true, deleted_at: now, is_active: false } });
    await audit(req, {
      action: 'DELETE', resource: RESOURCE_GAME, resource_id: existing.id,
      old_values: { is_deleted: false, is_active: existing.is_active }, new_values: { is_deleted: true, deleted_at: now, is_active: false },
    }, tx);
  });
  return { id: existing.id };
}

// ─── lots : écritures (US-081) ───────────────────────────────────────────

function prizeToPayload(p) {
  return {
    prize_type_id: p.prize_type_id,
    name_fr: p.name_fr,
    name_ar: p.name_ar,
    probability_weight: Number(p.probability_weight),
    stock_limit: p.stock_limit,
    sort_order: p.sort_order,
    is_active: p.is_active,
    value: R.toNumOrNull(p.value),
    sku_id: p.sku_id,
    pack_id: p.pack_id,
    coupon_code_prefix: p.coupon_code_prefix,
    coupon_promo_type_id: p.coupon_promo_type_id,
    coupon_min_order_amount: Number(p.coupon_min_order_amount ?? 0),
    coupon_validity_days: p.coupon_validity_days,
  };
}

async function findPrizeOr404(game, prizeId) {
  const pid = R.uuid(prizeId, 'Lot', { required: true });
  const prize = await prisma.gamificationPrize.findFirst({ where: { id: pid, game_id: game.id, is_deleted: false } });
  if (!prize) throw bad('Lot introuvable pour ce jeu', 404);
  return prize;
}

/**
 * Contrôle de l'ensemble des lots après modification : bloquant si le jeu est
 * actif (il doit rester jouable) ; simple avertissement s'il est inactif (les
 * contrôles seront rejoués à l'enregistrement et à l'activation).
 */
async function checkSetAfterChange(game, nextPrizes) {
  const enriched = await enrichPrizes(nextPrizes, game.node_id);
  const { errors, warnings } = R.checkPrizeSet(enriched, game);
  if (errors.length && game.is_active) {
    throw bad(`Le jeu est actif : ${errors.join(' ')} Désactivez le jeu pour le reconfigurer.`);
  }
  if (errors.length) warnings.unshift(...errors.map((e) => `À corriger avant enregistrement / activation : ${e}`));
  return warnings;
}

/** POST /gamification/games/:id/prizes */
async function addPrize(req, gameId, body = {}) {
  const game = await findGameOr404(gameId);
  const lk = await loadLookups();
  const { data, code } = R.normalizePrize(body, lk);
  await assertPrizeRefs(data, code, game.node_id);
  const warnings = [];
  applyStockLimit(data, 0, warnings);
  const others = await prisma.gamificationPrize.findMany({ where: { game_id: game.id, is_deleted: false } });
  warnings.push(...await checkSetAfterChange(game, [...others, data]));
  const prize = await prisma.$transaction(async (tx) => {
    const created = await tx.gamificationPrize.create({ data: { ...data, game_id: game.id } });
    await audit(req, { action: 'CREATE', resource: RESOURCE_PRIZE, resource_id: created.id, new_values: { game_id: game.id, ...data } }, tx);
    return created;
  });
  return { prize: plainPrize(prize), game: await getGame(game.id), warnings };
}

/** PUT /gamification/games/:id/prizes/:prizeId — lot attribué : seuls poids, plafond, ordre et activation. */
async function updatePrize(req, gameId, prizeId, body = {}) {
  const game = await findGameOr404(gameId);
  const existing = await findPrizeOr404(game, prizeId);
  const lk = await loadLookups();
  const current = prizeToPayload(existing);
  const merged = { ...current };
  for (const k of Object.keys(current)) {
    if (Object.prototype.hasOwnProperty.call(body, k)) merged[k] = body[k];
  }
  const { data, code } = R.normalizePrize(merged, lk);
  const playsOnPrize = await prisma.gamificationPlay.count({ where: { prize_id: existing.id } });
  if (existing.awarded_count > 0 || playsOnPrize > 0) {
    const changed = R.changedLockedPrizeFields(current, data);
    if (changed.length) {
      throw bad(`Lot déjà attribué (${existing.awarded_count}) : ${changed.join(', ')} ne sont plus modifiables. Seuls le poids, le stock max, l'ordre et l'activation restent éditables.`, 409);
    }
  }
  await assertPrizeRefs(data, code, game.node_id);
  const warnings = [];
  applyStockLimit(data, existing.awarded_count, warnings);
  if (body.is_active === true || body.is_active === 'true') {
    if (!data.is_active) throw bad('Impossible de réactiver ce lot : son stock max est atteint. Augmentez le stock max.');
  }
  const others = await prisma.gamificationPrize.findMany({ where: { game_id: game.id, is_deleted: false, id: { not: existing.id } } });
  warnings.push(...await checkSetAfterChange(game, [...others, { ...existing, ...data }]));

  const diffOld = {};
  const diffNew = {};
  for (const k of Object.keys(data)) {
    if (!R.sameValue(current[k], data[k])) {
      diffOld[k] = current[k];
      diffNew[k] = data[k];
    }
  }
  const prize = await prisma.$transaction(async (tx) => {
    const updated = await tx.gamificationPrize.update({ where: { id: existing.id }, data });
    if (Object.keys(diffNew).length) {
      await audit(req, { action: 'UPDATE', resource: RESOURCE_PRIZE, resource_id: existing.id, old_values: diffOld, new_values: diffNew }, tx);
    }
    return updated;
  });
  return { prize: plainPrize(prize), game: await getGame(game.id), warnings };
}

/**
 * DELETE /gamification/games/:id/prizes/:prizeId — refusé pour un lot déjà
 * attribué (US-080 D). Sinon SOFT-DELETE (is_deleted + deleted_at, et
 * is_active = false) : le lot sort des listes, du calcul des poids /
 * pourcentages et du tirage (le moteur ne tire que des lots actifs).
 */
async function deletePrize(req, gameId, prizeId) {
  const game = await findGameOr404(gameId);
  const existing = await findPrizeOr404(game, prizeId);
  const playsOnPrize = await prisma.gamificationPlay.count({ where: { prize_id: existing.id } });
  if (existing.awarded_count > 0 || playsOnPrize > 0) {
    throw bad(`Lot déjà attribué (${Math.max(existing.awarded_count, playsOnPrize)}) : suppression impossible. Désactivez-le à la place.`, 409);
  }
  const others = await prisma.gamificationPrize.findMany({ where: { game_id: game.id, is_deleted: false, id: { not: existing.id } } });
  const warnings = await checkSetAfterChange(game, others);
  await prisma.$transaction(async (tx) => {
    const deletedAt = new Date();
    await tx.gamificationPrize.update({
      where: { id: existing.id },
      data: { is_deleted: true, deleted_at: deletedAt, is_active: false },
    });
    await audit(req, {
      action: 'DELETE',
      resource: RESOURCE_PRIZE,
      resource_id: existing.id,
      old_values: { game_id: game.id, ...prizeToPayload(existing), is_deleted: false },
      new_values: { is_deleted: true, is_active: false, deleted_at: deletedAt.toISOString() },
    }, tx);
  });
  return { id: existing.id, game: await getGame(game.id), warnings };
}

module.exports = {
  loadLookups,
  getLookups,
  getNodePacks,
  searchNodeSkus,
  enrichPrizes,
  listGames,
  getGame,
  getDeleteLocks,
  createGame,
  updateGame,
  activateGame,
  deactivateGame,
  deleteCheck,
  deleteGame,
  addPrize,
  updatePrize,
  deletePrize,
};
