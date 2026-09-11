/**
 * Pickup service — retrait magasin.
 * Workflow: ready → (collect-cod optionnel) → confirm → delivered + stock OUT
 */
const prisma  = require('../../config/database');
const h       = require('../../utils/statusHelpers');
const { notifyDelivered } = require('../../utils/notify');
const loyalty = require('../loyalty/loyalty.service');
const { audit } = require('../../utils/audit');
const L = require('../orders_mgmt/order_lifecycle');

// ── Shared includes ───────────────────────────────────────────────────────────
const ORDER_LIST_INCLUDE = {
  status:        { select: { code: true, name_fr: true, color: true } },
  delivery_type: { select: { code: true, name_fr: true } },
  node:          { select: { id: true, name_fr: true, code: true } },
  customer:      { select: { id: true, name: true, phone_country: true, phone_number: true } },
  confirmed_slot:{ select: { slot_start: true, slot_end: true, name_fr: true } },
  _count:        { select: { items: { where: { parent_item_id: null } } } }, // composants de pack regroupés sous leur en-tête
  payments: {
    take: 1,
    orderBy: { created_at: 'desc' },
    include: {
      payment_method: { select: { code: true, name_fr: true } },
      status:         { select: { code: true, name_fr: true } },
    },
  },
};

const ORDER_DETAIL_INCLUDE = {
  ...ORDER_LIST_INCLUDE,
  address:  true,
  items: {
    where: { status: { code: { not: 'cancelled' } } },
    include: {
      status: { select: { code: true, name_fr: true, color: true } },
      sku: { select: { id: true, name_fr: true, sku_code: true, ean13: true, price: true } },
      pack: { select: { id: true, name_fr: true } },
      parent_item: { select: { id: true, pack: { select: { id: true, name_fr: true } } } },
    },
    orderBy: { unit_price_sold: 'desc' },
  },
  history: {
    include: { status: { select: { code: true, name_fr: true, color: true } } },
    orderBy: { created_at: 'asc' },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function ensurePickup(order) {
  if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
  if (order.delivery_type?.code !== 'pickup')
    throw { statusCode: 422, message: 'Cette commande n\'est pas de type retrait magasin (pickup)' };
}

function ensureReady(order) {
  if (!['ready', 'delivered'].includes(order.status?.code) && order.status?.code !== 'ready')
    throw { statusCode: 422, message: `Statut "${order.status?.name_fr}" — action impossible (statut requis : ready)` };
  if (order.status?.code !== 'ready')
    throw { statusCode: 422, message: `Commande déjà ${order.status?.name_fr}` };
}

// ── List ready pickup orders ──────────────────────────────────────────────────
async function listReadyOrders({ node_id, search } = {}) {
  const where = {
    is_deleted:    false,
    status:        { code: 'ready' },
    delivery_type: { code: 'pickup' },
    ...(node_id ? { node_id } : {}),
  };
  if (search?.trim()) {
    const s = search.trim();
    where.OR = [
      { id:       { contains: s, mode: 'insensitive' } },
      { customer: { name:         { contains: s, mode: 'insensitive' } } },
      { customer: { phone_number: { contains: s, mode: 'insensitive' } } },
    ];
  }
  const orders = await prisma.order.findMany({
    where, include: ORDER_LIST_INCLUDE, orderBy: { created_at: 'asc' },
  });
  return orders;
}

// ── Order detail ──────────────────────────────────────────────────────────────
async function getOrderDetail(orderId) {
  const order = await prisma.order.findUnique({
    where:   { id: orderId },
    include: ORDER_DETAIL_INCLUDE,
  });
  if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
  if (order.delivery_type?.code !== 'pickup')
    throw { statusCode: 422, message: 'Cette commande n\'est pas de type pickup' };
  // Compatibilité écran : order_history + sku.article.
  // Pack : ligne d'en-tête (pack_id, sku_id NULL) suivie de ses composants (à remettre au client) ;
  // lignes remplacées par substitution back-office exclues.
  const replaced = await L.replacedLineIds(order.items || []);
  const rows = (order.items || []).filter((it) => !replaced.has(it.id)).map((it) => ({
    ...it,
    is_pack_header: !!it.pack_id && !it.sku_id,
    name_fr: it.sku?.name_fr ?? it.pack?.name_fr ?? 'Article',
    pack: it.pack ?? it.parent_item?.pack ?? null,
    sku: it.sku ? { ...it.sku, article: { id: it.sku.id, name_fr: it.sku.name_fr, sku_code: it.sku.sku_code, ean13: it.sku.ean13, price: it.sku.price } } : it.sku,
  }));
  const ids = new Set(rows.map((r) => r.id));
  const byParent = {};
  for (const r of rows) if (r.parent_item_id && ids.has(r.parent_item_id)) (byParent[r.parent_item_id] ||= []).push(r);
  return {
    ...order,
    order_history: order.history,
    items: rows
      .filter((r) => !(r.parent_item_id && ids.has(r.parent_item_id)))
      .flatMap((r) => [r, ...(byParent[r.id] ?? [])]),
  };
}

// ── Collect COD (separate step before confirm) ────────────────────────────────
async function collectCOD(orderId, { amount_collected, payment_note } = {}, changed_by = null, req = null) {
  const order = await prisma.order.findUnique({
    where:   { id: orderId },
    include: {
      status:        true,
      delivery_type: true,
      payments: { include: { payment_method: true, status: true } },
    },
  });

  ensurePickup(order);
  ensureReady(order);

  const payment = order.payments?.[0];
  if (!payment) throw { statusCode: 422, message: 'Aucun paiement enregistré pour cette commande' };
  if (payment.payment_method?.code !== 'cod')
    throw { statusCode: 422, message: 'Le paiement COD ne s\'applique pas à cette commande' };
  if (payment.status?.code === 'collected' || order.cod_collected_at)
    throw { statusCode: 409, message: 'Paiement COD déjà collecté' };

  const total = Number(order.total_ttc);
  const collected = Number(amount_collected ?? total);
  if (collected < total)
    throw { statusCode: 422, message: `Montant insuffisant (${collected} MAD < ${total} MAD requis)` };

  const [collectedStatusId, readyStatusRow] = await Promise.all([
    h.getPaymentStatusId('collected'),
    h.getOrderStatus('ready'),
  ]);

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data:  {
        status_id: collectedStatusId,
        collected_at: new Date(),
        collected_by: 'Comptoir (retrait magasin)',
        notes: payment_note ?? null,
        metadata:  {
          ...(payment.metadata ?? {}),
          cod_collected_at:     new Date().toISOString(),
          cod_collected_amount: collected,
          cod_collected_note:   payment_note ?? null,
          cod_collected_by:     changed_by ?? null,
        },
      },
    });

    if (readyStatusRow) {
      await tx.orderHistory.create({
        data: {
          order_id:   orderId,
          status_id:  readyStatusRow.id,
          changed_by: changed_by,
          note:       `Paiement COD collecté au comptoir (${collected.toFixed(2)} MAD)${payment_note ? ' — ' + payment_note : ''}`,
        },
      });
    }

    await tx.order.update({
      where: { id: orderId },
      data:  { cod_collected_at: new Date() },
    });

    await audit(req, {
      action: 'COLLECT_PAYMENT', resource: 'payments', resource_id: payment.id,
      old_values: { status: payment.status?.code, amount: Number(payment.amount) },
      new_values: { status: 'collected', amount_collected: collected, collected_by: 'Comptoir (retrait magasin)', order_id: orderId },
    }, tx);
  });

  return getOrderDetail(orderId);
}

// ── Confirm pickup → delivered + stock OUT ────────────────────────────────────
async function confirmPickup(orderId, { note } = {}, changed_by = null, req = null) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      status:        true,
      delivery_type: true,
      items:         { include: { sku: { select: { id: true } } } },
      payments:      { include: { payment_method: { select: { code: true } }, status: { select: { code: true } } } },
      customer:      { select: { id: true, wallet_balance: true, points_balance: true, points_lifetime: true } },
    },
  });

  ensurePickup(order);
  ensureReady(order);

  // COD must be collected before confirming
  const payment  = order.payments?.[0];
  const isCOD    = payment?.payment_method?.code === 'cod';
  const payCode  = payment?.status?.code;
  if (!payment) throw { statusCode: 422, message: 'Aucun paiement enregistré pour cette commande' };
  if (isCOD && payCode !== 'collected')
    throw { statusCode: 422, message: 'Le paiement COD doit être encaissé avant de confirmer le retrait. Utilisez d\'abord collect-cod.' };
  if (!isCOD && !['pending', 'collected'].includes(payCode ?? ''))
    throw { statusCode: 422, message: `Statut paiement incompatible (${payCode})` };

  const [deliveredStatus, collectedStatus, saleMoveType, readyStatus] = await Promise.all([
    h.getOrderStatus('delivered'),
    h.getPaymentStatus('collected'),
    prisma.moveType.findFirst({ where: { code: 'sale' } }),
    h.getOrderStatus('ready'),
  ]);
  if (!deliveredStatus) throw { statusCode: 500, message: 'Statut "delivered" introuvable — lancez le seed' };

  // Points calculated via rules engine (see loyalty.service.js)

  await prisma.$transaction(async (tx) => {
    // Collect non-COD payment if still pending
    if (!isCOD && payCode === 'pending' && collectedStatus && payment) {
      await tx.payment.update({ where: { id: payment.id }, data: { status_id: collectedStatus.id } });
    }

    // Sortie de stock (WF #31) : mouvement « sale », physique et réservation diminués, rupture soldée
    await L.applyDeliveryStock(tx, orderId, req, `Retrait commande pickup — ${orderId.slice(0, 8)}`);

    // Update order → delivered
    await tx.order.update({
      where: { id: orderId },
      data: {
        status_id:       deliveredStatus.id,
        cod_collected_at: isCOD ? (order.cod_collected_at ?? new Date()) : undefined,
      },
    });

    // Credit points via rules engine
    await loyalty.creditPointsOnDelivery(tx, order.customer_id, { ...order, id: orderId }, deliveredStatus.id);

    // Order history — delivered
    await tx.orderHistory.create({
      data: {
        order_id:   orderId,
        status_id:  deliveredStatus.id,
        changed_by: changed_by,
        note:       note?.trim() || 'Commande retirée par le client au magasin',
      },
    });

    await audit(req, {
      action: 'UPDATE_STATUS', resource: 'orders', resource_id: orderId,
      old_values: { status: 'ready' }, new_values: { status: 'delivered', pickup: true },
    }, tx);

  }, { timeout: 30000 });

  // Notification (fire-and-forget outside tx)
  setImmediate(() => {
    notifyDelivered(order.customer_id, orderId, 0).catch(() => {});
    loyalty.validateReferralOnDelivery(order.customer_id, orderId).catch(() => {});
  });

  return getOrderDetail(orderId);
}

// ── Cancel ready order → annulation centrale (WF #29 : motif obligatoire,
//    tous les compteurs remis à jour en une transaction, audit CANCEL_ORDER) ──
async function cancelReadyOrder(orderId, { reason } = {}, changed_by = null, req = null) {
  const order = await prisma.order.findUnique({
    where:   { id: orderId },
    include: { status: true, delivery_type: true },
  });
  ensurePickup(order);
  if (order.status?.code !== 'ready')
    throw { statusCode: 422, message: `Statut "${order.status?.name_fr}" — annulation impossible (statut requis : ready)` };

  await L.cancelOrder(orderId, reason, req || (changed_by ? { user: { id: changed_by } } : null));
  return getOrderDetail(orderId);
}

module.exports = { listReadyOrders, getOrderDetail, collectCOD, confirmPickup, cancelReadyOrder };
