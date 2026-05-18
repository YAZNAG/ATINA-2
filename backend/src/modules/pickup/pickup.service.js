/**
 * Pickup service — retrait magasin.
 * Workflow: ready → (collect-cod optionnel) → confirm → delivered + stock OUT
 */
const prisma  = require('../../config/database');
const h       = require('../../utils/statusHelpers');
const { notifyDelivered } = require('../../utils/notify');
const loyalty = require('../loyalty/loyalty.service');

// ── Shared includes ───────────────────────────────────────────────────────────
const ORDER_LIST_INCLUDE = {
  status:        { select: { code: true, name_fr: true, color: true } },
  delivery_type: { select: { code: true, name_fr: true } },
  node:          { select: { id: true, name_fr: true, code: true } },
  customer:      { select: { id: true, name: true, phone_country: true, phone_number: true } },
  confirmed_slot:{ select: { slot_start: true, slot_end: true, name_fr: true } },
  _count:        { select: { items: true } },
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
      sku: {
        include: {
          article: { select: { id: true, name_fr: true, sku_code: true, ean13: true, price: true } },
        },
      },
    },
    orderBy: { created_at: 'asc' },
  },
  order_history: {
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
  return order;
}

// ── Collect COD (separate step before confirm) ────────────────────────────────
async function collectCOD(orderId, { amount_collected, payment_note } = {}, changed_by = null) {
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
  if (payment.status?.code === 'collected')
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
          changed_by: null,
          note:       `Paiement COD collecté au comptoir (${collected.toFixed(2)} MAD)${payment_note ? ' — ' + payment_note : ''}`,
        },
      });
    }

    await tx.order.update({
      where: { id: orderId },
      data:  { cod_collected_at: new Date() },
    });
  });

  return getOrderDetail(orderId);
}

// ── Confirm pickup → delivered + stock OUT ────────────────────────────────────
async function confirmPickup(orderId, { note } = {}, changed_by = null) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      status:        true,
      delivery_type: true,
      items:         { include: { sku: { select: { id: true } } } },
      payments:      { include: { payment_method: { select: { code: true } }, status: { select: { code: true } } } },
      customer:      { select: { id: true, wallet_balance: true, points_balance: true, points_lifetime: true, points_earned: true } },
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

  // Validate stock
  for (const item of order.items) {
    if (!item.sku_id) continue;
    const qty   = Number(item.qty);
    const level = await prisma.stockLevel.findUnique({
      where: { node_id_sku_id: { node_id: order.node_id, sku_id: item.sku_id } },
    });
    if (!level) throw { statusCode: 422, message: 'Stock introuvable pour un article' };
    if (Number(level.qty_reserved) < qty || Number(level.qty_physical) < qty)
      throw { statusCode: 422, message: 'Stock insuffisant pour finaliser le retrait' };
  }

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

    // Stock: qty_reserved--, qty_physical-- (qty_available unchanged per formula)
    for (const item of order.items) {
      if (!item.sku_id) continue;
      const qty = Number(item.qty);
      const upd = await tx.stockLevel.updateMany({
        where: { node_id: order.node_id, sku_id: item.sku_id, qty_reserved: { gte: qty }, qty_physical: { gte: qty } },
        data:  { qty_reserved: { decrement: qty }, qty_physical: { decrement: qty } },
      });
      if (upd.count !== 1)
        throw { statusCode: 422, message: 'Mise à jour stock impossible — rollback déclenché' };

      // Stock move OUT
      if (saleMoveType) {
        await tx.stockMove.create({
          data: {
            node_id:      order.node_id,
            sku_id:       item.sku_id,
            move_type_id: saleMoveType.id,
            order_id:     orderId,
            qty_delta:    -qty,
            reason:       `Retrait commande pickup — ${orderId.slice(0, 8)}`,
          },
        });
      }
    }

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
        changed_by: null,
        note:       note?.trim() || 'Commande retirée par le client au magasin',
      },
    });

    // Order history — stock note
    if (readyStatus) {
      await tx.orderHistory.create({
        data: {
          order_id:   orderId,
          status_id:  deliveredStatus.id,
          changed_by: null,
          note:       'Stock physique décrémenté après retrait confirmé',
        },
      });
    }

    // Notification (fire-and-forget outside tx)
    setImmediate(() => {
      notifyDelivered(order.customer_id, orderId, 0).catch(() => {});
      loyalty.validateReferralOnDelivery(order.customer_id, orderId).catch(() => {});
    });
  });

  return getOrderDetail(orderId);
}

// ── Cancel ready order (releases reservation) ─────────────────────────────────
async function cancelReadyOrder(orderId, { reason } = {}, changed_by = null) {
  const order = await prisma.order.findUnique({
    where:   { id: orderId },
    include: {
      status:        true,
      delivery_type: true,
      items:         true,
    },
  });

  ensurePickup(order);
  if (order.status?.code !== 'ready')
    throw { statusCode: 422, message: `Statut "${order.status?.name_fr}" — annulation impossible (statut requis : ready)` };

  const [cancelledStatus, cancelMoveType] = await Promise.all([
    h.getOrderStatus('cancelled'),
    prisma.moveType.findFirst({ where: { code: 'reservation_cancel' } }),
  ]);
  if (!cancelledStatus) throw { statusCode: 500, message: 'Statut "cancelled" introuvable' };

  await prisma.$transaction(async (tx) => {
    // Release stock reservations
    for (const item of order.items) {
      if (!item.sku_id) continue;
      const reserved   = Number(item.qty) - Number(item.qty_backordered ?? 0);
      const backordered = Number(item.qty_backordered ?? 0);

      if (reserved > 0) {
        await tx.stockLevel.updateMany({
          where: { node_id: order.node_id, sku_id: item.sku_id, qty_reserved: { gte: reserved } },
          data:  { qty_reserved: { decrement: reserved }, qty_available: { increment: reserved } },
        });
      }
      if (backordered > 0) {
        await tx.stockLevel.updateMany({
          where: { node_id: order.node_id, sku_id: item.sku_id },
          data:  { qty_backordered: { decrement: backordered } },
        });
      }
      if (cancelMoveType) {
        await tx.stockMove.create({
          data: {
            node_id:      order.node_id,
            sku_id:       item.sku_id,
            move_type_id: cancelMoveType.id,
            order_id:     orderId,
            qty_delta:    0,
            reason:       `Annulation retrait — ${orderId.slice(0, 8)}`,
          },
        });
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data:  { status_id: cancelledStatus.id, cancelled_reason: reason ?? null },
    });

    await tx.orderHistory.create({
      data: {
        order_id:   orderId,
        status_id:  cancelledStatus.id,
        changed_by: null,
        note:       `Retrait annulé${reason ? ' — ' + reason : ''}. Réservation stock libérée.`,
      },
    });
  });

  return getOrderDetail(orderId);
}

module.exports = { listReadyOrders, getOrderDetail, collectCOD, confirmPickup, cancelReadyOrder };
