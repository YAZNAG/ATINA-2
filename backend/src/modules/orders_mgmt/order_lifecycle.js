/**
 * Cycle de vie d'une commande — règles transverses partagées par le
 * back-office (orders_mgmt), les tournées (delivery_mgmt) et le retrait (pickup).
 *
 *  - statuts & transitions contrôlées (US-057)
 *  - créneaux : capacité, préférences, affectation (WF #3 / #20, US-037 / US-107)
 *  - annulation complète en une transaction (WF #29, US-058 / US-110)
 *  - livraison : sortie de stock (WF #31, US-109)
 *  - encaissement COD (WF #30, US-060 / US-061)
 */
const prisma = require('../../config/database');
const { audit } = require('../../utils/audit');
const { buildLabel } = require('../loyalty/points-ledger.util');

// ── Statuts ─────────────────────────────────────────────────────────────────
const ALIASES = {
  OUT_FOR_DELIVERY: 'in_delivery',
  IN_DELIVERY: 'in_delivery',
  PARTIALLY_DELIVERED: 'delivered',
};

function normStatus(code) {
  const raw = String(code || '').trim();
  if (!raw) return '';
  return ALIASES[raw.toUpperCase()] || raw.toLowerCase();
}

/** Transitions "avant" (hors annulation, qui a son propre parcours avec motif). */
const FLOW = {
  pending: ['confirmed', 'awaiting_stock'],
  awaiting_stock: ['confirmed'],
  confirmed: ['picking', 'awaiting_stock'],
  picking: ['ready'],
  ready: ['in_delivery', 'delivered'],
  in_delivery: ['delivered'],
};

const TRANSITION_LABELS = {
  confirmed: 'Confirmer',
  awaiting_stock: 'Mettre en attente de stock',
  picking: 'Lancer la préparation',
  ready: 'Marquer prête',
  in_delivery: 'Mettre en livraison',
  delivered: 'Marquer livrée',
};

/** Statuts depuis lesquels l'annulation est autorisée (US-058 bloc 0). */
const CANCELLABLE = ['pending', 'awaiting_stock', 'confirmed', 'picking', 'ready', 'in_delivery'];
/** Points d'échange remboursés tant que la préparation n'est pas terminée (US-110 bloc 6). */
const POINTS_REFUNDABLE = ['pending', 'awaiting_stock', 'confirmed', 'picking'];
/** Réaffectation de créneau / encaissement : statuts bloqués. */
const CLOSED = ['delivered', 'cancelled', 'returned'];

function allowedTransitions(order) {
  const current = normStatus(order?.status?.code);
  if (order?.status?.is_terminal || CLOSED.includes(current)) return [];
  let next = FLOW[current] || [];
  const isPickup = ['pickup', 'in_store'].includes(String(order?.delivery_type?.code || '').toLowerCase());
  if (current === 'ready') next = isPickup ? ['delivered'] : ['in_delivery'];
  return next;
}

// ── Lookups par code (insensibles à la casse) ────────────────────────────────
const byCode = (model, code, client = prisma) =>
  client[model].findFirst({ where: { code: { equals: code, mode: 'insensitive' } } });

async function mustCode(model, code, label, client = prisma) {
  const row = await byCode(model, code, client);
  if (!row) throw { statusCode: 500, message: `Référentiel manquant : ${label} « ${code} » introuvable en base` };
  return row;
}

// ── Dates de créneau ─────────────────────────────────────────────────────────
function dateKey(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** « YYYY-MM-DD » + « HH:MM » interprétés dans le fuseau du node → Date UTC. */
function zonedDateTime(dateStr, hhmm, timeZone = 'Africa/Casablanca') {
  const [Y, M, D] = String(dateStr).split('-').map(Number);
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  const guess = Date.UTC(Y, (M || 1) - 1, D || 1, h || 0, m || 0, 0);
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const p = Object.fromEntries(dtf.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return new Date(guess - (asUtc - guess));
  } catch {
    return new Date(guess);
  }
}

function slotLabel(slot) {
  if (!slot) return null;
  const d = dateKey(slot.specific_date);
  const name = slot.name_fr ? ` (${slot.name_fr})` : '';
  return `${d ?? ''} ${slot.slot_start}–${slot.slot_end}${name}`.trim();
}

// ── Capacité des créneaux (comptage, jamais un compteur stocké — US-110 bloc 9) ──
async function slotReservations(slotIds, { excludeOrderId = null, client = prisma } = {}) {
  const ids = [...new Set((slotIds || []).filter(Boolean))];
  if (!ids.length) return {};
  const rows = await client.order.groupBy({
    by: ['confirmed_slot_id'],
    where: {
      confirmed_slot_id: { in: ids },
      is_deleted: false,
      status: { code: { not: 'cancelled' } },
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
    },
    _count: { _all: true },
  });
  const map = {};
  for (const r of rows) map[r.confirmed_slot_id] = r._count._all;
  return map;
}

async function slotPreferenceStats(slotIds, client = prisma) {
  const ids = [...new Set((slotIds || []).filter(Boolean))];
  if (!ids.length) return {};
  const rows = await client.orderSlotPreference.findMany({
    where: { slot_id: { in: ids } },
    select: { slot_id: true, status: { select: { code: true } } },
  });
  const map = {};
  for (const r of rows) {
    const code = r.status?.code || 'preferred';
    map[r.slot_id] = map[r.slot_id] || { total: 0, preferred: 0, confirmed: 0, rejected: 0, expired: 0 };
    map[r.slot_id].total += 1;
    map[r.slot_id][code] = (map[r.slot_id][code] || 0) + 1;
  }
  return map;
}

/** Enrichit des créneaux avec réservations / places restantes / préférences. */
async function enrichSlotsCapacity(slots, { excludeOrderId = null } = {}) {
  const ids = slots.map((s) => s.id);
  const [res, prefs] = await Promise.all([
    slotReservations(ids, { excludeOrderId }),
    slotPreferenceStats(ids),
  ]);
  return slots.map((s) => {
    const reservations = res[s.id] || 0;
    const max = s.max_orders ?? null;
    return {
      ...s,
      date: dateKey(s.specific_date),
      reservations,
      remaining: max != null ? Math.max(0, max - reservations) : null,
      is_full: max != null ? reservations >= max : false,
      preferences: prefs[s.id] || { total: 0, preferred: 0, confirmed: 0, rejected: 0, expired: 0 },
    };
  });
}

// ── Packs : nombre de packs commandés à partir des lignes ────────────────────
/**
 * Les packs sont stockés en lignes composants (pack_id + sku_id, qty = nb packs × qty composant),
 * éventuellement avec une ligne parent (pack_id, sku_id NULL, qty = nb packs).
 * Renvoie { [pack_id]: nombre_de_packs }.
 */
async function countPacks(items, client = prisma) {
  const packLines = (items || []).filter((i) => i.pack_id);
  if (!packLines.length) return {};
  const result = {};
  const parents = packLines.filter((i) => !i.sku_id);
  for (const p of parents) result[p.pack_id] = (result[p.pack_id] || 0) + Number(p.qty);

  const withoutParent = [...new Set(packLines.filter((i) => i.sku_id && !result[i.pack_id]).map((i) => i.pack_id))];
  if (withoutParent.length) {
    const packItems = await client.packItem.findMany({ where: { pack_id: { in: withoutParent } } });
    for (const packId of withoutParent) {
      const recipe = packItems.filter((pi) => pi.pack_id === packId);
      const lines = packLines.filter((l) => l.pack_id === packId && l.sku_id);
      let n = 0;
      for (const line of lines) {
        const r = recipe.find((pi) => pi.sku_id === line.sku_id);
        const perPack = Number(r?.qty ?? 0);
        if (perPack > 0) { n = Math.round(Number(line.qty) / perPack); break; }
      }
      if (!n && lines.length) n = 1;
      result[packId] = n;
    }
  }
  return result;
}

// ── Verrou + lecture d'un niveau de stock ────────────────────────────────────
async function lockStockLevel(tx, node_id, sku_id) {
  await tx.$queryRaw`SELECT id FROM stock_levels WHERE node_id = ${node_id}::uuid AND sku_id = ${sku_id}::uuid FOR UPDATE`;
  return tx.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });
}

const n3 = (v) => Math.round(Number(v || 0) * 1000) / 1000;

// ── ANNULATION (WF #29 — US-058 / US-110) ───────────────────────────────────
const ORDER_CANCEL_INCLUDE = {
  status: true,
  delivery_type: true,
  customer: { select: { id: true, name: true, points_balance: true } },
  confirmed_slot: true,
  items: {
    include: {
      status: { select: { code: true } },
      sku: { select: { id: true, name_fr: true, sku_code: true } },
      pack: { select: { id: true, name_fr: true, sold_count: true, max_pack_qty: true } },
      flash_sale: { select: { id: true, name_fr: true, sold_count: true, stock_flash: true } },
    },
  },
  payments: { include: { status: true, payment_method: true } },
  promotion: { select: { id: true, code: true, uses_count: true } },
  slot_preferences: { include: { status: true } },
  tour_stops: { include: { tour: { select: { id: true, order_count: true, status: { select: { code: true } } } } } },
};

async function loadOrderForCancel(orderId, client = prisma) {
  const order = await client.order.findFirst({ where: { id: orderId, is_deleted: false }, include: ORDER_CANCEL_INCLUDE });
  if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
  return order;
}

function assertCancellable(order) {
  const code = normStatus(order.status?.code);
  if (code === 'delivered') {
    throw { statusCode: 422, message: 'Commande déjà livrée : elle ne peut pas être annulée. Utilisez la procédure de retour.' };
  }
  if (!CANCELLABLE.includes(code)) {
    throw { statusCode: 422, message: `Commande au statut « ${order.status?.name_fr || code} » : annulation impossible (état terminal).` };
  }
}

const activeItems = (order) => (order.items || []).filter((i) => String(i.status?.code || '').toLowerCase() !== 'cancelled');

/** Impact calculé AVANT validation (écran de confirmation — US-058). */
async function previewCancel(orderId) {
  const order = await loadOrderForCancel(orderId);
  const code = normStatus(order.status?.code);
  const cancellable = CANCELLABLE.includes(code);
  const items = activeItems(order);

  const released = items
    .filter((i) => i.sku_id)
    .map((i) => ({
      sku_id: i.sku_id,
      name: i.sku?.name_fr || i.sku?.sku_code || 'Produit',
      pack: i.pack?.name_fr || null,
      qty_reserved_released: n3(Number(i.qty) - Number(i.qty_backordered || 0)),
      qty_backorder_released: n3(i.qty_backordered),
    }));

  const pointsSpent = Number(order.points_redeemed || 0)
    || items.reduce((s, i) => s + Number(i.points_spent || 0), 0);
  const packs = await countPacks(items);
  const gamePlayIds = [...new Set(items.filter((i) => i.game_play_id).map((i) => i.game_play_id))];
  const pendingPayments = (order.payments || []).filter((p) => String(p.status?.code).toLowerCase() === 'pending');

  return {
    order_id: order.id,
    status: { code, name_fr: order.status?.name_fr },
    cancellable,
    refusal_reason: cancellable ? null
      : code === 'delivered'
        ? 'Commande livrée : utilisez la procédure de retour.'
        : 'Statut terminal : annulation impossible.',
    released_products: released,
    points: {
      spent: pointsSpent,
      outcome: pointsSpent === 0 ? 'none' : POINTS_REFUNDABLE.includes(code) ? 'refunded' : 'lost',
    },
    game_prizes: gamePlayIds.length,
    packs: Object.entries(packs).map(([pack_id, qty]) => ({
      pack_id, qty, name: items.find((i) => i.pack_id === pack_id)?.pack?.name_fr || 'Pack',
    })),
    flash_sales: items.filter((i) => i.flash_sale_id).map((i) => ({ flash_sale_id: i.flash_sale_id, name: i.flash_sale?.name_fr, qty: n3(i.qty) })),
    promo_code: order.promotion ? order.promotion.code : null,
    slot: order.confirmed_slot ? slotLabel(order.confirmed_slot) : null,
    slot_preferences: (order.slot_preferences || []).length,
    tour: order.tour_stops?.length ? order.tour_stops.map((s) => s.tour_id) : [],
    payments_to_cancel: pendingPayments.map((p) => ({ id: p.id, amount: Number(p.amount), method: p.payment_method?.name_fr || p.payment_method?.code })),
  };
}

/**
 * Annule une commande : motif obligatoire, TOUS les compteurs corrigés dans UNE
 * transaction, une ligne d'audit CANCEL_ORDER par compteur modifié.
 */
async function cancelOrder(orderId, reason, req = null) {
  const motif = String(reason ?? '').trim();
  if (!motif) throw { statusCode: 400, message: "Le motif d'annulation est obligatoire." };

  const [cancelledStatus, cancelledItemStatus, expiredSlotStatus, payCancelled] = await Promise.all([
    mustCode('orderStatus', 'cancelled', 'statut commande'),
    byCode('orderItemStatus', 'cancelled'),
    byCode('orderSlotStatus', 'expired'),
    byCode('paymentStatus', 'cancelled').then((r) => r || byCode('paymentStatus', 'failed')),
  ]);

  const userId = req?.user?.id ?? null;
  const A = (tx, resource, resource_id, old_values, new_values) =>
    audit(req, { action: 'CANCEL_ORDER', resource, resource_id, old_values, new_values }, tx);

  const result = await prisma.$transaction(async (tx) => {
    const order = await loadOrderForCancel(orderId, tx);
    assertCancellable(order);
    const code = normStatus(order.status?.code);
    const items = activeItems(order);

    // BLOC 1 — statut commande + lignes
    await tx.order.update({
      where: { id: order.id },
      data: { status_id: cancelledStatus.id, cancelled_reason: motif },
    });
    await tx.orderHistory.create({
      data: { order_id: order.id, status_id: cancelledStatus.id, changed_by: userId, note: `Annulation : ${motif}` },
    });
    await A(tx, 'orders', order.id,
      { status: code, cancelled_reason: order.cancelled_reason },
      { status: 'cancelled', cancelled_reason: motif });
    if (cancelledItemStatus && items.length) {
      await tx.orderItem.updateMany({ where: { order_id: order.id, id: { in: items.map((i) => i.id) } }, data: { status_id: cancelledItemStatus.id } });
      await A(tx, 'order_items', order.id, { active_lines: items.length }, { status: 'cancelled', lines: items.map((i) => i.id) });
    }

    // BLOCS 2, 3, 4 — réservation + rupture (lignes produit ET composants de pack)
    for (const item of items) {
      if (!item.sku_id) continue;
      const qty = Number(item.qty);
      const qb = Number(item.qty_backordered || 0);
      const reservedPart = Math.max(0, qty - qb);
      const level = await lockStockLevel(tx, order.node_id, item.sku_id);
      if (level && (reservedPart > 0 || qb > 0)) {
        const oldRes = Number(level.qty_reserved);
        const newRes = Math.max(0, oldRes - reservedPart);
        const released = oldRes - newRes;
        const oldBo = Number(level.qty_backordered);
        const newBo = Math.max(0, oldBo - qb);
        const data = {
          qty_reserved: n3(newRes),
          qty_available: n3(Number(level.qty_available) + released),
          qty_backordered: n3(newBo),
        };
        await tx.stockLevel.update({ where: { id: level.id }, data });
        await A(tx, 'stock_levels', level.id,
          { qty_reserved: n3(oldRes), qty_available: n3(level.qty_available), qty_backordered: n3(oldBo) },
          { ...data, sku_id: item.sku_id, order_item_id: item.id });
      }
      if (qb > 0) {
        const rule = await tx.sellingRule.findUnique({ where: { node_id_sku_id: { node_id: order.node_id, sku_id: item.sku_id } } });
        if (rule) {
          const newQ = n3(Math.max(0, Number(rule.backordered_quantity) - qb));
          await tx.sellingRule.update({ where: { id: rule.id }, data: { backordered_quantity: newQ } });
          await A(tx, 'selling_rules', rule.id, { backordered_quantity: n3(rule.backordered_quantity) }, { backordered_quantity: newQ });
        }
        await tx.orderItem.update({ where: { id: item.id }, data: { qty_backordered: 0 } });
        await A(tx, 'order_items', item.id, { qty_backordered: n3(qb) }, { qty_backordered: 0 });
      }
    }

    // BLOC 4 (suite) — plafond commercial des packs
    const packs = await countPacks(items, tx);
    const { adjustPackSoldCount } = require('../pack/pack.shared');
    for (const [packId, nb] of Object.entries(packs)) {
      const pack = await tx.pack.findUnique({ where: { id: packId }, select: { id: true, sold_count: true } });
      if (!pack || !nb) continue;
      const res = await adjustPackSoldCount(packId, -nb, tx);
      if (res.sold_count !== pack.sold_count) {
        await A(tx, 'packs', packId, { sold_count: pack.sold_count }, { sold_count: res.sold_count, packs_annules: nb });
      }
    }

    // BLOC 5 — vente flash (quota rendu, stock_flash jamais modifié)
    const flashQty = {};
    const flashPackCounted = new Set();
    for (const item of items) {
      if (!item.flash_sale_id) continue;
      if (item.pack_id) {
        const key = `${item.flash_sale_id}:${item.pack_id}`;
        if (flashPackCounted.has(key)) continue;
        flashPackCounted.add(key);
        flashQty[item.flash_sale_id] = (flashQty[item.flash_sale_id] || 0) + (packs[item.pack_id] || 1);
      } else {
        flashQty[item.flash_sale_id] = (flashQty[item.flash_sale_id] || 0) + Number(item.qty);
      }
    }
    for (const [fsId, q] of Object.entries(flashQty)) {
      const fs = await tx.flashSale.findUnique({ where: { id: fsId }, select: { id: true, sold_count: true } });
      if (!fs) continue;
      const after = Math.max(0, fs.sold_count - Math.round(q));
      if (after !== fs.sold_count) {
        await tx.flashSale.update({ where: { id: fsId }, data: { sold_count: after } });
        await A(tx, 'flash_sales', fsId, { sold_count: fs.sold_count }, { sold_count: after });
      }
    }

    // BLOC 6 — points dépensés (remboursés si préparation non terminée)
    const pointsSpent = Number(order.points_redeemed || 0)
      || items.reduce((s, i) => s + Number(i.points_spent || 0), 0);
    let pointsOutcome = 'none';
    if (pointsSpent > 0) {
      if (POINTS_REFUNDABLE.includes(code)) {
        const cust = await tx.customer.update({
          where: { id: order.customer_id },
          data: { points_balance: { increment: pointsSpent } },
          select: { points_balance: true },
        });
        const txn = await tx.pointsTransaction.create({
          data: {
            customer_id: order.customer_id,
            order_id: order.id,
            type: 'exchange_revert',
            points: pointsSpent,
            balance_after: cust.points_balance,
            label: buildLabel(`Annulation commande ${order.id.slice(0, 8).toUpperCase()} — ${motif}`),
          },
        });
        await A(tx, 'points_transactions', txn.id,
          { points_balance: cust.points_balance - pointsSpent },
          { points_balance: cust.points_balance, points: pointsSpent, type: 'exchange_revert' });
        pointsOutcome = 'refunded';
      } else {
        await A(tx, 'customers', order.customer_id,
          { points_spent: pointsSpent },
          { points_refunded: 0, motif: 'Points non remboursés : préparation terminée (commande prête ou en livraison)' });
        pointsOutcome = 'lost';
      }
    }

    // BLOC 7 — lots gagnés (free_sku / free_pack) : lot rendu au pool, participation expirée
    const playIds = [...new Set(items.filter((i) => i.game_play_id).map((i) => i.game_play_id))];
    for (const playId of playIds) {
      const play = await tx.gamificationPlay.findUnique({ where: { id: playId }, include: { prize: true } });
      if (!play) continue;
      const now = new Date();
      await tx.gamificationPlay.update({ where: { id: playId }, data: { claimed_at: null, expires_at: now } });
      await A(tx, 'game_plays', playId, { claimed_at: play.claimed_at, expires_at: play.expires_at }, { claimed_at: null, expires_at: now });
      if (play.prize) {
        const prize = play.prize;
        const after = Math.max(0, prize.awarded_count - 1);
        const reactivate = !prize.is_active && prize.stock_limit != null
          && prize.awarded_count >= prize.stock_limit && after < prize.stock_limit;
        await tx.gamificationPrize.update({
          where: { id: prize.id },
          data: { awarded_count: after, ...(reactivate ? { is_active: true } : {}) },
        });
        await A(tx, 'game_prizes', prize.id,
          { awarded_count: prize.awarded_count, is_active: prize.is_active },
          { awarded_count: after, is_active: reactivate ? true : prize.is_active });
      }
    }

    // BLOC 8 — code promo (une seule fois par commande)
    if (order.promotion_id) {
      const promo = await tx.promotion.findUnique({ where: { id: order.promotion_id }, select: { id: true, uses_count: true } });
      if (promo) {
        const after = Math.max(0, promo.uses_count - 1);
        await tx.promotion.update({ where: { id: promo.id }, data: { uses_count: after } });
        await A(tx, 'promotions', promo.id, { uses_count: promo.uses_count }, { uses_count: after });
      }
      // Limite par client : aucune suppression physique (US-058) — la redemption reste
      // rattachée à la commande annulée ; l'éligibilité du client se calcule en excluant
      // les redemptions dont la commande est annulée (voir coupons.shared.validateCoupon).
      const redemptions = await tx.couponRedemption.count({ where: { promotion_id: order.promotion_id, order_id: order.id } });
      if (redemptions) {
        await A(tx, 'coupon_redemptions', order.id, { redemptions, order_status: code }, { order_status: 'cancelled', counted_for_customer: false });
      }
    }

    // BLOC 9 — préférences de créneau → expirées ; confirmed_slot conservé (trace)
    if (expiredSlotStatus && order.slot_preferences?.length) {
      const toExpire = order.slot_preferences.filter((p) => p.status_id !== expiredSlotStatus.id);
      if (toExpire.length) {
        await tx.orderSlotPreference.updateMany({ where: { id: { in: toExpire.map((p) => p.id) } }, data: { status_id: expiredSlotStatus.id } });
        await A(tx, 'order_slot_preferences', order.id,
          { statuses: toExpire.map((p) => ({ slot_id: p.slot_id, status: p.status?.code || null })) },
          { status: 'expired' });
      }
    }
    if (order.confirmed_slot_id) {
      await A(tx, 'delivery_slots', order.confirmed_slot_id, { place_occupee_par: order.id }, { place_liberee: true });
    }

    // BLOC 10 — tournée : arrêt retiré, order_count décrémenté, arrêts renumérotés
    for (const stop of order.tour_stops || []) {
      await removeStopTx(tx, stop, req, 'CANCEL_ORDER');
    }
    if (order.tour_id) {
      await tx.order.update({ where: { id: order.id }, data: { tour_id: null } });
    }

    // BLOC 11 — paiement en attente annulé (jamais un paiement encaissé)
    for (const p of order.payments || []) {
      if (String(p.status?.code).toLowerCase() !== 'pending' || !payCancelled) continue;
      await tx.payment.update({ where: { id: p.id }, data: { status_id: payCancelled.id } });
      await A(tx, 'payments', p.id, { status: 'pending', amount: Number(p.amount) }, { status: payCancelled.code, montant_restant: 0 });
    }

    return { order_id: order.id, previous_status: code, points: pointsOutcome, customer_id: order.customer_id };
  }, { timeout: 30000 });

  try {
    const { notifyCancelled } = require('../../utils/notify');
    notifyCancelled(result.customer_id, result.order_id, motif).catch(() => {});
  } catch { /* notification optionnelle */ }

  return result;
}

// ── Tournées : retrait d'un arrêt (partagé annulation / gestion tournée) ────
/**
 * Supprime l'arrêt, décrémente tours.order_count, renumérote les arrêts suivants,
 * détache la commande. `stop` doit contenir id, tour_id, order_id, sort_order.
 */
async function removeStopTx(tx, stop, req = null, action = 'UPDATE') {
  const tour = await tx.tour.findUnique({ where: { id: stop.tour_id }, select: { id: true, order_count: true } });
  await tx.tourStop.delete({ where: { id: stop.id } });
  const following = await tx.tourStop.findMany({
    where: { tour_id: stop.tour_id, sort_order: { gt: stop.sort_order } },
    orderBy: { sort_order: 'asc' },
  });
  for (const s of following) {
    await tx.tourStop.update({ where: { id: s.id }, data: { sort_order: s.sort_order - 1 } });
  }
  const remaining = await tx.tourStop.count({ where: { tour_id: stop.tour_id } });
  await tx.tour.update({ where: { id: stop.tour_id }, data: { order_count: remaining } });
  if (stop.order_id) {
    await tx.order.updateMany({ where: { id: stop.order_id, tour_id: stop.tour_id }, data: { tour_id: null } });
  }
  await audit(req, {
    action,
    resource: 'tour_stops',
    resource_id: stop.id,
    old_values: { tour_id: stop.tour_id, order_id: stop.order_id, sort_order: stop.sort_order, order_count: tour?.order_count ?? null },
    new_values: { removed: true, order_count: remaining, renumbered: following.length },
  }, tx);
  return remaining;
}

// ── LIVRAISON : sortie de stock (WF #31 — US-109) ────────────────────────────
/**
 * À appeler dans la transaction qui passe la commande à « livrée ».
 * Pour chaque ligne active avec SKU : mouvement « sale » (append-only),
 * qty_physical −= qty, qty_reserved −= part réservée, rupture soldée,
 * qty_floating_cod += qty si le COD n'est pas encore encaissé.
 */
async function applyDeliveryStock(tx, orderId, req = null, reason = 'Livraison — vente') {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { status: { select: { code: true } } } },
      payments: { include: { status: { select: { code: true } }, payment_method: { select: { code: true } } } },
    },
  });
  if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
  const saleType = await byCode('moveType', 'sale', tx);
  const codPending = (order.payments || []).some((p) =>
    String(p.payment_method?.code || '').toLowerCase() === 'cod' && String(p.status?.code || '').toLowerCase() === 'pending');

  const moves = [];
  for (const item of order.items) {
    if (!item.sku_id) continue;
    if (String(item.status?.code || '').toLowerCase() === 'cancelled') continue;
    const qty = Number(item.qty);
    if (!(qty > 0)) continue;
    const qb = Number(item.qty_backordered || 0);
    const reservedPart = Math.max(0, qty - qb);

    let move = null;
    if (saleType) {
      move = await tx.stockMove.create({
        data: {
          node_id: order.node_id, sku_id: item.sku_id, move_type_id: saleType.id,
          order_id: order.id, qty_delta: -qty, reason, operator_id: req?.user?.id ?? null,
        },
      });
    }

    const level = await lockStockLevel(tx, order.node_id, item.sku_id);
    if (level) {
      const oldPhys = Number(level.qty_physical);
      const oldRes = Number(level.qty_reserved);
      const newPhys = Math.max(0, oldPhys - qty);
      const newRes = Math.max(0, oldRes - reservedPart);
      const data = {
        qty_physical: n3(newPhys),
        qty_reserved: n3(newRes),
        qty_available: n3(Number(level.qty_available) - (oldPhys - newPhys) + (oldRes - newRes)),
        qty_backordered: n3(Math.max(0, Number(level.qty_backordered) - qb)),
        ...(codPending ? { qty_floating_cod: n3(Number(level.qty_floating_cod) + qty) } : {}),
        ...(move ? { last_move_id: move.id } : {}),
      };
      await tx.stockLevel.update({ where: { id: level.id }, data });
    }
    if (qb > 0) {
      const rule = await tx.sellingRule.findUnique({ where: { node_id_sku_id: { node_id: order.node_id, sku_id: item.sku_id } } });
      if (rule) {
        await tx.sellingRule.update({
          where: { id: rule.id },
          data: { backordered_quantity: n3(Math.max(0, Number(rule.backordered_quantity) - qb)) },
        });
      }
    }
    moves.push({ sku_id: item.sku_id, qty, move_id: move?.id ?? null, backorder_settled: qb });
  }

  await audit(req, {
    action: 'DELIVER_ORDER',
    resource: 'orders',
    resource_id: order.id,
    old_values: null,
    new_values: { stock_moves: moves, qty_floating_cod: codPending },
  }, tx);
  return moves;
}

// ── ENCAISSEMENT COD (WF #30) ────────────────────────────────────────────────
async function collectPayment(orderId, { collected_by, collected_at, notes } = {}, req = null) {
  const who = String(collected_by ?? '').trim();
  if (!who) throw { statusCode: 400, message: "Indiquez qui a encaissé (en général le livreur)." };
  const when = collected_at ? new Date(collected_at) : new Date();
  if (Number.isNaN(when.getTime())) throw { statusCode: 400, message: "Date d'encaissement invalide." };
  if (when.getTime() > Date.now() + 5 * 60 * 1000) throw { statusCode: 400, message: "La date d'encaissement ne peut pas être dans le futur." };

  const collected = await mustCode('paymentStatus', 'collected', 'statut paiement');

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, is_deleted: false },
      include: {
        status: true,
        items: { include: { status: { select: { code: true } } } },
        payments: { include: { status: true, payment_method: true }, orderBy: { created_at: 'asc' } },
      },
    });
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
    const code = normStatus(order.status?.code);
    if (code === 'cancelled') throw { statusCode: 422, message: 'Commande annulée : aucun encaissement possible.' };
    if (!['delivered', 'in_delivery'].includes(code)) {
      throw { statusCode: 422, message: "L'encaissement n'est possible que sur une commande livrée ou en cours de livraison." };
    }
    if (order.payments.some((p) => String(p.status?.code).toLowerCase() === 'collected') || order.cod_collected_at) {
      throw { statusCode: 409, message: 'Paiement déjà encaissé : un seul encaissement par commande.' };
    }
    const payment = order.payments.find((p) => String(p.status?.code).toLowerCase() === 'pending');
    if (!payment) throw { statusCode: 422, message: 'Aucun paiement « à encaisser » pour cette commande.' };

    const upd = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status_id: collected.id,
        collected_by: who.slice(0, 150),
        collected_at: when,
        notes: notes?.trim() || null,
      },
      include: { status: true, payment_method: true },
    });
    await tx.order.update({ where: { id: order.id }, data: { cod_collected_at: when } });

    // Fin du suivi « livré non encaissé » (US-109) si la livraison a déjà eu lieu.
    if (code === 'delivered') {
      for (const item of order.items) {
        if (!item.sku_id || String(item.status?.code).toLowerCase() === 'cancelled') continue;
        const level = await lockStockLevel(tx, order.node_id, item.sku_id);
        if (level && Number(level.qty_floating_cod) > 0) {
          await tx.stockLevel.update({
            where: { id: level.id },
            data: { qty_floating_cod: n3(Math.max(0, Number(level.qty_floating_cod) - Number(item.qty))) },
          });
        }
      }
    }

    await audit(req, {
      action: 'COLLECT_PAYMENT',
      resource: 'payments',
      resource_id: payment.id,
      old_values: { status: 'pending', amount: Number(payment.amount) },
      new_values: { status: 'collected', collected_by: who, collected_at: when, notes: notes?.trim() || null, order_id: order.id },
    }, tx);
    return upd;
  });
}

module.exports = {
  normStatus, allowedTransitions, TRANSITION_LABELS, CANCELLABLE, CLOSED, POINTS_REFUNDABLE,
  byCode, mustCode, dateKey, zonedDateTime, slotLabel,
  slotReservations, slotPreferenceStats, enrichSlotsCapacity, countPacks,
  previewCancel, cancelOrder, removeStopTx, applyDeliveryStock, collectPayment,
};
