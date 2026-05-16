/**
 * Tour service — manages home-delivery tours.
 * Workflow: planned → in_progress → completed
 * Each stop: pending → delivered | failed | skipped
 */
const prisma = require('../../config/database');
const h = require('../../utils/statusHelpers');

// ── Includes ──────────────────────────────────────────────────────────────────
const STOP_INCLUDE = {
  status: { select: { id: true, code: true, name_fr: true } },
  order: {
    include: {
      status:        { select: { id: true, code: true, name_fr: true, color: true } },
      customer:      { select: { id: true, name: true, phone_country: true, phone_number: true } },
      address:       true,
      delivery_type: { select: { code: true, name_fr: true } },
      payments:      { include: { payment_method: { select: { code: true, name_fr: true } }, status: { select: { code: true } } } },
      items: {
        include: { sku: { select: { id: true, article: { select: { name_fr: true, sku_code: true } } } } },
      },
    },
  },
};

const TOUR_INCLUDE = {
  status: { select: { id: true, code: true, name_fr: true } },
  node:   { select: { id: true, name_fr: true, code: true } },
  stops:  { include: STOP_INCLUDE, orderBy: { sort_order: 'asc' } },
};

// ── List tours ────────────────────────────────────────────────────────────────
async function listTours({ page = 1, limit = 25, status_code, node_id } = {}) {
  const where = {};
  if (status_code) where.status = { code: status_code };
  if (node_id)     where.node_id = node_id;

  const [data, total] = await Promise.all([
    prisma.tour.findMany({
      where, include: TOUR_INCLUDE,
      orderBy: { created_at: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
    prisma.tour.count({ where }),
  ]);
  return { data, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } };
}

// ── Get tour ──────────────────────────────────────────────────────────────────
async function getTour(id) {
  const tour = await prisma.tour.findUnique({ where: { id }, include: TOUR_INCLUDE });
  if (!tour) throw { statusCode: 404, message: 'Tournée introuvable' };
  return tour;
}

// ── Ready home-delivery orders (no active tour) ───────────────────────────────
async function getReadyHomeOrders(node_id) {
  return prisma.order.findMany({
    where: {
      is_deleted:    false,
      status:        { code: 'ready' },
      delivery_type: { code: 'home' },
      tour_id:       null,
      ...(node_id ? { node_id } : {}),
    },
    include: {
      status:   { select: { code: true, name_fr: true } },
      customer: { select: { id: true, name: true, phone_country: true, phone_number: true } },
      address:  true,
      node:     { select: { id: true, name_fr: true } },
    },
    orderBy: { created_at: 'asc' },
  });
}

// ── Create tour ───────────────────────────────────────────────────────────────
async function createTour({ node_id, planned_at, notes } = {}) {
  const statusId = await h.getTourStatusId('planned');
  const tour = await prisma.tour.create({
    data: { node_id: node_id || null, status_id: statusId, planned_at: planned_at ? new Date(planned_at) : null, notes: notes || null },
    include: TOUR_INCLUDE,
  });
  return tour;
}

// ── Add orders to tour ────────────────────────────────────────────────────────
async function addOrdersToTour(tour_id, order_ids) {
  const tour = await getTour(tour_id);
  if (!['planned'].includes(tour.status.code))
    throw { statusCode: 422, message: 'Impossible d\'ajouter des commandes à une tournée déjà démarrée' };

  const [stopStatusId, homeTypeRow] = await Promise.all([
    h.getStopStatusId('pending'),
    prisma.deliveryType.findFirst({ where: { code: 'home' } }),
  ]);

  // Validate orders
  const orders = await prisma.order.findMany({
    where: { id: { in: order_ids }, is_deleted: false, tour_id: null },
    include: { status: true, delivery_type: true },
  });

  const valid = orders.filter(o =>
    o.status.code === 'ready' &&
    o.delivery_type?.code === 'home'
  );

  if (!valid.length) throw { statusCode: 422, message: 'Aucune commande valide (statut ready, type home, sans tournée)' };

  const currentMax = tour.stops.reduce((max, s) => Math.max(max, s.sort_order), 0);

  const created = await prisma.$transaction(async (tx) => {
    const stops = [];
    for (let i = 0; i < valid.length; i++) {
      const order = valid[i];
      const stop = await tx.tourStop.create({
        data: { tour_id, order_id: order.id, status_id: stopStatusId, sort_order: currentMax + i + 1 },
        include: STOP_INCLUDE,
      });
      await tx.order.update({ where: { id: order.id }, data: { tour_id } });
      stops.push(stop);
    }
    return stops;
  });

  return { added: created.length, stops: created };
}

// ── Remove stop from tour ─────────────────────────────────────────────────────
async function removeStop(stop_id) {
  const stop = await prisma.tourStop.findUnique({ where: { id: stop_id }, include: { tour: { include: { status: true } } } });
  if (!stop) throw { statusCode: 404, message: 'Stop introuvable' };
  if (stop.tour.status.code !== 'planned') throw { statusCode: 422, message: 'Impossible de supprimer un stop d\'une tournée démarrée' };

  await prisma.$transaction(async (tx) => {
    await tx.tourStop.delete({ where: { id: stop_id } });
    if (stop.order_id) await tx.order.update({ where: { id: stop.order_id }, data: { tour_id: null } });
  });
  return { id: stop_id };
}

// ── Start tour ────────────────────────────────────────────────────────────────
async function startTour(tour_id, changed_by = null) {
  const tour = await getTour(tour_id);
  if (tour.status.code !== 'planned') throw { statusCode: 422, message: `Tournée déjà ${tour.status.name_fr}` };
  if (!tour.stops.length) throw { statusCode: 422, message: 'La tournée n\'a aucun stop — ajoutez des commandes' };

  const [tourInProgressId, orderInDeliveryStatus] = await Promise.all([
    h.getTourStatusId('in_progress'),
    h.getOrderStatus('in_delivery'),
  ]);

  await prisma.$transaction(async (tx) => {
    await tx.tour.update({ where: { id: tour_id }, data: { status_id: tourInProgressId } });

    for (const stop of tour.stops) {
      if (!stop.order_id) continue;
      await tx.order.update({ where: { id: stop.order_id }, data: { status_id: orderInDeliveryStatus.id } });
      await tx.orderHistory.create({
        data: { order_id: stop.order_id, status_id: orderInDeliveryStatus.id, changed_by, note: 'Tournée de livraison démarrée' },
      });
    }
  });

  return getTour(tour_id);
}

// ── Deliver a stop ────────────────────────────────────────────────────────────
async function deliverStop(stop_id, { payment_collected = false, note } = {}, changed_by = null) {
  const stop = await prisma.tourStop.findUnique({
    where: { id: stop_id },
    include: {
      tour:   { include: { status: true } },
      status: true,
      order:  {
        include: {
          status:        true,
          delivery_type: true,
          items:         { include: { sku: { select: { id: true } } } },
          payments:      { include: { payment_method: { select: { code: true } }, status: { select: { code: true } } } },
        },
      },
    },
  });
  if (!stop) throw { statusCode: 404, message: 'Stop introuvable' };
  if (stop.tour.status.code !== 'in_progress') throw { statusCode: 422, message: 'Démarrez la tournée avant de livrer' };
  if (stop.status.code === 'delivered') throw { statusCode: 422, message: 'Stop déjà livré' };
  if (!stop.order_id) throw { statusCode: 422, message: 'Stop sans commande associée' };

  const order = stop.order;
  if (!order) throw { statusCode: 404, message: 'Commande du stop introuvable' };
  if (order.status.code !== 'in_delivery') throw { statusCode: 422, message: `Statut commande "${order.status.code}" — attendu: in_delivery` };

  const payment = order.payments?.[0];
  const isCOD = payment?.payment_method?.code === 'cod';
  if (isCOD && !payment_collected) throw { statusCode: 422, message: 'COD: confirmez l\'encaissement avant de marquer livré (payment_collected: true)' };

  const [deliveredStopId, deliveredOrderStatus, collectedPayId, saleMoveType, debitTxnType] = await Promise.all([
    h.getStopStatusId('delivered'),
    h.getOrderStatus('delivered'),
    h.getPaymentStatusId('collected'),
    prisma.moveType.findFirst({ where: { code: { in: ['sale', 'VENTE'] } } }),
    prisma.walletTxnType.findFirst({ where: { code: 'debit_order' } }),
  ]);

  const pointsToCredit = Number(order.points_earned) > 0
    ? 0
    : Math.max(0, Math.floor(Number(order.total_ttc) / 10));

  await prisma.$transaction(async (tx) => {
    // Update stop
    await tx.tourStop.update({ where: { id: stop_id }, data: { status_id: deliveredStopId } });

    // Update order
    await tx.order.update({
      where: { id: order.id },
      data: {
        status_id:     deliveredOrderStatus.id,
        ...(isCOD && !order.cod_collected_at ? { cod_collected_at: new Date() } : {}),
        ...(pointsToCredit > 0 ? { points_earned: pointsToCredit } : {}),
      },
    });

    await tx.orderHistory.create({
      data: { order_id: order.id, status_id: deliveredOrderStatus.id, changed_by, note: note?.trim() || 'Livraison confirmée par le chauffeur' },
    });

    // Collect payment
    if (payment && isCOD && payment.status.code === 'pending') {
      await tx.payment.update({ where: { id: payment.id }, data: { status_id: collectedPayId } });
    }

    // Release stock (sale): decrement qty_reserved + qty_available per spec
    for (const item of order.items) {
      if (!item.sku_id) continue;
      const qty = Number(item.qty);
      await tx.stockLevel.updateMany({
        where:  { node_id: order.node_id, sku_id: item.sku_id, qty_reserved: { gte: qty }, qty_available: { gte: qty } },
        data:   { qty_reserved: { decrement: qty }, qty_available: { decrement: qty } },
      });
      if (saleMoveType) {
        await tx.stockMove.create({
          data: { node_id: order.node_id, sku_id: item.sku_id, move_type_id: saleMoveType.id, order_id: order.id, qty_delta: -qty, reason: 'Livraison — vente' },
        });
      }
    }

    // Credit points
    if (pointsToCredit > 0) {
      await tx.customer.update({
        where: { id: order.customer_id },
        data:  { points_balance: { increment: pointsToCredit }, points_lifetime: { increment: pointsToCredit } },
      });
    }
  });

  return prisma.tourStop.findUnique({ where: { id: stop_id }, include: STOP_INCLUDE });
}

// ── Fail a stop ───────────────────────────────────────────────────────────────
async function failStop(stop_id, { reason, note } = {}, changed_by = null) {
  const stop = await prisma.tourStop.findUnique({
    where: { id: stop_id },
    include: { tour: { include: { status: true } }, status: true, order: { include: { status: true } } },
  });
  if (!stop) throw { statusCode: 404, message: 'Stop introuvable' };
  if (stop.tour.status.code !== 'in_progress') throw { statusCode: 422, message: 'Tournée non démarrée' };

  const [failedStopId, readyStatusRow] = await Promise.all([
    h.getStopStatusId('failed'),
    h.getOrderStatus('ready'),
  ]);

  await prisma.$transaction(async (tx) => {
    await tx.tourStop.update({ where: { id: stop_id }, data: { status_id: failedStopId } });
    // Revert order to ready (will need re-scheduling)
    if (stop.order_id && readyStatusRow) {
      await tx.order.update({ where: { id: stop.order_id }, data: { status_id: readyStatusRow.id, tour_id: null } });
      await tx.orderHistory.create({
        data: { order_id: stop.order_id, status_id: readyStatusRow.id, changed_by, note: note || `Échec livraison: ${reason || 'raison non précisée'}` },
      });
    }
  });

  return prisma.tourStop.findUnique({ where: { id: stop_id }, include: STOP_INCLUDE });
}

// ── Complete tour ─────────────────────────────────────────────────────────────
async function completeTour(tour_id, changed_by = null) {
  const tour = await getTour(tour_id);
  if (tour.status.code !== 'in_progress') throw { statusCode: 422, message: `Tournée "${tour.status.name_fr}" — non démarrée` };

  const pending = tour.stops.filter(s => s.status.code === 'pending');
  if (pending.length > 0) throw { statusCode: 422, message: `${pending.length} stop(s) encore en attente — traitez tous les stops` };

  const completedId = await h.getTourStatusId('completed');
  await prisma.tour.update({ where: { id: tour_id }, data: { status_id: completedId } });
  return getTour(tour_id);
}

// ── Tour meta (statuses for filters) ─────────────────────────────────────────
async function getMeta() {
  const [statuses, nodes] = await Promise.all([
    prisma.tourStatus.findMany({ orderBy: { code: 'asc' } }),
    prisma.node.findMany({ where: { is_active: true, is_deleted: false }, select: { id: true, name_fr: true, code: true } }),
  ]);
  return { statuses, nodes };
}

module.exports = { listTours, getTour, getReadyHomeOrders, createTour, addOrdersToTour, removeStop, startTour, deliverStop, failStop, completeTour, getMeta };
