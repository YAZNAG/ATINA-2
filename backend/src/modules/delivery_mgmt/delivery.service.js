/**
 * Delivery management service.
 * Manages the complete home-delivery lifecycle:
 *   ready → tour planned → in_progress → stops delivered/failed → completed
 */
const prisma = require('../../config/database');
const h      = require('../../utils/statusHelpers');
const { notifyInDelivery, notifyDelivered, notifyCancelled } = require('../../utils/notify');

// ── Shared includes ───────────────────────────────────────────────────────────
const STOP_INCLUDE = {
  status: { select: { id: true, code: true, name_fr: true } },
  order: {
    include: {
      status:        { select: { id: true, code: true, name_fr: true, color: true } },
      customer:      { select: { id: true, name: true, phone_country: true, phone_number: true } },
      address:       true,
      node:          { select: { id: true, name_fr: true } },
      delivery_type: { select: { code: true, name_fr: true } },
      payments: {
        take: 1,
        orderBy: { created_at: 'desc' },
        include: { payment_method: { select: { code: true, name_fr: true } }, status: { select: { code: true, name_fr: true } } },
      },
      confirmed_slot: { select: { slot_start: true, slot_end: true, name_fr: true } },
      _count: { select: { items: true } },
    },
  },
};

const TOUR_INCLUDE = {
  status: { select: { id: true, code: true, name_fr: true } },
  node:   { select: { id: true, name_fr: true, code: true } },
  driver: { select: { id: true, name: true, phone_country: true, phone_number: true, vehicle_type: true, vehicle_plate: true } },
  stops:  { include: STOP_INCLUDE, orderBy: { sort_order: 'asc' } },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getTour(id) {
  const tour = await prisma.tour.findUnique({ where: { id }, include: TOUR_INCLUDE });
  if (!tour) throw { statusCode: 404, message: 'Tournée introuvable' };
  return tour;
}

function checkTourStatus(tour, expected) {
  if (tour.status.code.toLowerCase() !== expected.toLowerCase())
    throw { statusCode: 422, message: `Tournée au statut "${tour.status.name_fr}" — attendu : "${expected}"` };
}

// ── Ready home orders (not in any active tour) ────────────────────────────────
async function listReadyHomeOrders({ node_id, search } = {}) {
  const where = {
    is_deleted:    false,
    status:        { code: 'ready' },
    delivery_type: { code: 'home' },
    tour_id:       null,
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
  return prisma.order.findMany({
    where,
    include: {
      status:         { select: { code: true, name_fr: true } },
      customer:       { select: { id: true, name: true, phone_country: true, phone_number: true } },
      address:        true,
      node:           { select: { id: true, name_fr: true } },
      confirmed_slot: { select: { slot_start: true, slot_end: true, name_fr: true } },
      payments: {
        take: 1, orderBy: { created_at: 'desc' },
        include: { payment_method: { select: { code: true, name_fr: true } }, status: { select: { code: true } } },
      },
      _count: { select: { items: true } },
    },
    orderBy: { created_at: 'asc' },
  });
}

// ── List tours ────────────────────────────────────────────────────────────────
async function listTours({ page = 1, limit = 25, status_code, node_id, driver_id } = {}) {
  const where = {};
  if (status_code) where.status  = { code: status_code };
  if (node_id)     where.node_id  = node_id;
  if (driver_id)   where.driver_id = driver_id;

  const [data, total] = await Promise.all([
    prisma.tour.findMany({
      where, include: TOUR_INCLUDE,
      orderBy: { created_at: 'desc' },
      skip: (Number(page) - 1) * Number(limit), take: Number(limit),
    }),
    prisma.tour.count({ where }),
  ]);
  return { data, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } };
}

// ── Create tour (with orders + optional driver) ───────────────────────────────
async function createTour({ node_id, driver_id, date, slot_start, slot_end, zone, planned_at, notes, order_ids = [] }) {
  // Validate node
  if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
  const node = await prisma.node.findFirst({ where: { id: node_id, is_active: true, is_deleted: false } });
  if (!node) throw { statusCode: 404, message: 'Node introuvable ou inactif' };

  // Validate driver if provided
  if (driver_id) {
    const driver = await prisma.driver.findFirst({ where: { id: driver_id, is_active: true, is_deleted: false } });
    if (!driver) throw { statusCode: 404, message: 'Driver introuvable ou inactif' };
    if (driver.node_id !== node_id)
      throw { statusCode: 422, message: `Driver ${driver.name} appartient au node ${driver.node_id}, pas au node ${node_id}` };
  }

  // Validate orders
  let validOrders = [];
  if (order_ids.length > 0) {
    const orders = await prisma.order.findMany({
      where: { id: { in: order_ids }, is_deleted: false, tour_id: null },
      include: { status: true, delivery_type: true },
    });
    validOrders = orders.filter(o => o.status.code.toLowerCase() === 'ready' && o.delivery_type?.code.toLowerCase() === 'home' && o.node_id === node_id);
    const skipped = order_ids.length - validOrders.length;
    if (skipped > 0 && validOrders.length === 0)
      throw { statusCode: 422, message: 'Aucune commande valide (home, ready, même node, sans tournée)' };
  }

  const [plannedStatusId, pendingStopId, confirmedOrderStatusRow] = await Promise.all([
    h.getTourStatusId('planned'),
    h.getStopStatusId('pending'),
    h.getOrderStatus('confirmed'),
  ]);

  const tour = await prisma.$transaction(async (tx) => {
    const newTour = await tx.tour.create({
      data: {
        node_id, driver_id: driver_id || null,
        status_id:  plannedStatusId,
        planned_at: planned_at ? new Date(planned_at) : null,
        date: date ?? null,
        slot_start: slot_start ?? null,
        slot_end:   slot_end ?? null,
        zone:       zone ?? null,
        notes:      notes ?? null,
      },
    });

    // Add orders as stops
    for (let i = 0; i < validOrders.length; i++) {
      const order = validOrders[i];
      await tx.tourStop.create({
        data: { tour_id: newTour.id, order_id: order.id, status_id: pendingStopId, sort_order: i + 1 },
      });
      await tx.order.update({ where: { id: order.id }, data: { tour_id: newTour.id } });

      // order_history
      const readyRow = await tx.orderStatus.findFirst({ where: { code: 'ready' } });
      if (readyRow) {
        await tx.orderHistory.create({
          data: { order_id: order.id, status_id: readyRow.id, changed_by: null, note: `Commande ajoutée à la tournée ${newTour.id.slice(0, 8)}` },
        });
      }
    }

    return newTour;
  });

  return getTour(tour.id);
}

// ── Assign driver to planned tour ─────────────────────────────────────────────
async function assignDriver(tour_id, driver_id) {
  const [tour, driver] = await Promise.all([
    getTour(tour_id),
    prisma.driver.findFirst({ where: { id: driver_id, is_active: true, is_deleted: false } }),
  ]);
  checkTourStatus(tour, 'planned');
  if (!driver) throw { statusCode: 404, message: 'Driver introuvable ou inactif' };
  if (tour.node_id && driver.node_id !== tour.node_id)
    throw { statusCode: 422, message: `Driver appartient au node ${driver.node_id}, pas au node de la tournée` };

  await prisma.tour.update({ where: { id: tour_id }, data: { driver_id } });
  return getTour(tour_id);
}

// ── Add orders to existing tour ───────────────────────────────────────────────
async function addOrdersToTour(tour_id, order_ids) {
  const tour = await getTour(tour_id);
  checkTourStatus(tour, 'planned');

  const [pendingStopId] = await Promise.all([h.getStopStatusId('pending')]);
  const orders = await prisma.order.findMany({
    where: { id: { in: order_ids }, is_deleted: false, tour_id: null },
    include: { status: true, delivery_type: true },
  });
  const valid = orders.filter(o => o.status.code.toLowerCase() === 'ready' && o.delivery_type?.code.toLowerCase() === 'home');
  if (!valid.length) throw { statusCode: 422, message: 'Aucune commande valide à ajouter' };

  const maxSort = tour.stops.reduce((m, s) => Math.max(m, s.sort_order), 0);
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < valid.length; i++) {
      const order = valid[i];
      await tx.tourStop.create({ data: { tour_id, order_id: order.id, status_id: pendingStopId, sort_order: maxSort + i + 1 } });
      await tx.order.update({ where: { id: order.id }, data: { tour_id } });
    }
  });
  return getTour(tour_id);
}

// ── Remove stop from planned tour ─────────────────────────────────────────────
async function removeStop(stop_id) {
  const stop = await prisma.tourStop.findUnique({ where: { id: stop_id }, include: { tour: { include: { status: true } } } });
  if (!stop) throw { statusCode: 404, message: 'Stop introuvable' };
  checkTourStatus(stop.tour, 'planned');
  await prisma.$transaction(async (tx) => {
    await tx.tourStop.delete({ where: { id: stop_id } });
    if (stop.order_id) await tx.order.update({ where: { id: stop.order_id }, data: { tour_id: null } });
  });
  return { id: stop_id, deleted: true };
}

// ── Start tour ────────────────────────────────────────────────────────────────
async function startTour(tour_id) {
  const tour = await getTour(tour_id);
  checkTourStatus(tour, 'planned');
  if (!tour.stops.length) throw { statusCode: 422, message: 'Aucun stop — ajoutez des commandes avant de démarrer' };

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
        data: { order_id: stop.order_id, status_id: orderInDeliveryStatus.id, changed_by: null, note: `Tournée démarrée — commande en livraison${tour.driver?.name ? ' par ' + tour.driver.name : ''}` },
      });
      // Notify customer
      notifyInDelivery(stop.order?.customer_id ?? stop.order?.order?.customer_id, stop.order_id).catch(() => {});
    }
  });

  return getTour(tour_id);
}

// ── Arrive at stop ────────────────────────────────────────────────────────────
async function arriveStop(stop_id, { driver_notes } = {}) {
  const stop = await prisma.tourStop.findUnique({
    where: { id: stop_id },
    include: { tour: { include: { status: true } }, status: true },
  });
  if (!stop) throw { statusCode: 404, message: 'Stop introuvable' };
  if (stop.tour.status.code.toLowerCase() !== 'in_progress') throw { statusCode: 422, message: 'Tournée non démarrée' };
  if (['delivered', 'failed'].includes(stop.status.code.toLowerCase()))
    throw { statusCode: 422, message: `Stop déjà ${stop.status.name_fr}` };

  const arrivedStatus = await h.getStopStatus('arrived') ?? await h.getStopStatus('in_progress');
  if (!arrivedStatus) throw { statusCode: 500, message: 'Statut stop "arrived"/"in_progress" introuvable' };
  await prisma.tourStop.update({
    where: { id: stop_id },
    data:  { status_id: arrivedStatus.id, driver_notes: driver_notes ?? stop.driver_notes ?? null },
  });
  return prisma.tourStop.findUnique({ where: { id: stop_id }, include: STOP_INCLUDE });
}

// ── Deliver stop ──────────────────────────────────────────────────────────────
async function deliverStop(stop_id, { cod_collected = false, amount_collected, driver_notes, note } = {}) {
  const stop = await prisma.tourStop.findUnique({
    where: { id: stop_id },
    include: {
      tour:  { include: { status: true, driver: { select: { id: true, name: true } } } },
      status: true,
      order: {
        include: {
          status:   true,
          items:    { include: { sku: { select: { id: true } } } },
          payments: { take: 1, orderBy: { created_at: 'desc' }, include: { payment_method: { select: { code: true } }, status: { select: { code: true } } } },
        },
      },
    },
  });
  if (!stop) throw { statusCode: 404, message: 'Stop introuvable' };
  if (stop.tour.status.code.toLowerCase() !== 'in_progress') throw { statusCode: 422, message: 'Démarrez la tournée avant de livrer' };
  if (stop.status.code.toLowerCase() === 'delivered') throw { statusCode: 409, message: 'Stop déjà livré' };
  if (!stop.order_id || !stop.order) throw { statusCode: 422, message: 'Stop sans commande' };

  const order   = stop.order;
  if (order.status.code.toLowerCase() !== 'in_delivery')
    throw { statusCode: 422, message: `Commande au statut "${order.status.code}" — attendu: in_delivery` };

  const payment = order.payments?.[0];
  const isCOD   = payment?.payment_method?.code.toLowerCase() === 'cod';
  if (isCOD && !cod_collected)
    throw { statusCode: 422, message: 'COD non collecté — indiquez cod_collected: true et amount_collected' };
  if (isCOD && cod_collected) {
    const total     = Number(order.total_ttc);
    const collected = Number(amount_collected ?? total);
    if (collected < total)
      throw { statusCode: 422, message: `Montant COD insuffisant (${collected} < ${total} MAD)` };
  }

  const [deliveredStopId, deliveredOrderId, collectedPayId, saleMoveType] = await Promise.all([
    h.getStopStatusId('delivered'),
    h.getOrderStatusId('delivered'),
    h.getPaymentStatusId('collected'),
    prisma.moveType.findFirst({ where: { code: 'sale' } }),
  ]);

  const pointsToCredit = Number(order.points_earned ?? 0) > 0
    ? 0
    : Math.max(0, Math.floor(Number(order.total_ttc) / 10));

  await prisma.$transaction(async (tx) => {
    // Update stop
    await tx.tourStop.update({
      where: { id: stop_id },
      data: {
        status_id:       deliveredStopId,
        delivered_at:    new Date(),
        cod_collected:   isCOD ? cod_collected : false,
        amount_collected: isCOD && cod_collected ? Number(amount_collected ?? order.total_ttc) : null,
        driver_notes:    driver_notes ?? null,
      },
    });

    // Update order
    await tx.order.update({
      where: { id: order.id },
      data: {
        status_id:       deliveredOrderId,
        ...(isCOD ? { cod_collected_at: new Date() } : {}),
        ...(pointsToCredit > 0 ? { points_earned: pointsToCredit } : {}),
      },
    });

    // Order history
    await tx.orderHistory.create({
      data: {
        order_id:   order.id,
        status_id:  deliveredOrderId,
        changed_by: null,
        note:       note?.trim() || `Livraison confirmée${stop.tour.driver?.name ? ' par ' + stop.tour.driver.name : ''}`,
      },
    });

    // COD: collect payment
    if (isCOD && cod_collected && payment && payment.status.code.toLowerCase() === 'pending') {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status_id: collectedPayId,
          metadata: {
            cod_collected_at:     new Date().toISOString(),
            cod_collected_amount: Number(amount_collected ?? order.total_ttc),
            cod_collected_by:     stop.tour.driver_id ?? null,
          },
        },
      });
    }

    // Stock: qty_reserved-- + qty_physical-- (qty_available unchanged)
    for (const item of order.items) {
      if (!item.sku_id) continue;
      const qty = Number(item.qty);
      const upd = await tx.stockLevel.updateMany({
        where: { node_id: order.node_id, sku_id: item.sku_id, qty_reserved: { gte: qty }, qty_physical: { gte: qty } },
        data:  { qty_reserved: { decrement: qty }, qty_physical: { decrement: qty } },
      });
      if (upd.count === 1 && saleMoveType) {
        await tx.stockMove.create({
          data: { node_id: order.node_id, sku_id: item.sku_id, move_type_id: saleMoveType.id, order_id: order.id, qty_delta: -qty, reason: 'Livraison domicile' },
        });
      }
    }

    // Points
    if (pointsToCredit > 0) {
      await tx.customer.update({
        where: { id: order.customer_id },
        data:  { points_balance: { increment: pointsToCredit }, points_lifetime: { increment: pointsToCredit } },
      });
    }

    // Auto-complete tour if all stops done
    const allStops = await tx.tourStop.findMany({ where: { tour_id: stop.tour_id } });
    const allDone  = allStops.every(s => s.id === stop_id ? true : ['delivered', 'failed', 'skipped'].includes((s.status?.code ?? '').toLowerCase()));
    if (allDone) {
      const completedId = await h.getTourStatusId('completed');
      await tx.tour.update({ where: { id: stop.tour_id }, data: { status_id: completedId } });
    }
  });

  // Notify customer
  notifyDelivered(order.customer_id, order.id, pointsToCredit).catch(() => {});

  return prisma.tourStop.findUnique({ where: { id: stop_id }, include: STOP_INCLUDE });
}

// ── Fail stop ─────────────────────────────────────────────────────────────────
async function failStop(stop_id, { failure_reason, driver_notes, revert_to_ready = true } = {}) {
  const stop = await prisma.tourStop.findUnique({
    where: { id: stop_id },
    include: { tour: { include: { status: true } }, status: true, order: { include: { status: true } } },
  });
  if (!stop) throw { statusCode: 404, message: 'Stop introuvable' };
  if (stop.tour.status.code.toLowerCase() !== 'in_progress') throw { statusCode: 422, message: 'Tournée non démarrée' };
  if (stop.status.code.toLowerCase() === 'delivered') throw { statusCode: 422, message: 'Stop déjà livré' };

  const [failedStopId, readyStatusRow, inDeliveryRow] = await Promise.all([
    h.getStopStatusId('failed'),
    h.getOrderStatus('ready'),
    h.getOrderStatus('in_delivery'),
  ]);

  await prisma.$transaction(async (tx) => {
    await tx.tourStop.update({
      where: { id: stop_id },
      data: {
        status_id:      failedStopId,
        failure_reason: failure_reason ?? null,
        driver_notes:   driver_notes ?? null,
      },
    });

    if (stop.order_id) {
      const targetStatus = revert_to_ready ? readyStatusRow : inDeliveryRow;
      if (targetStatus) {
        await tx.order.update({
          where: { id: stop.order_id },
          data:  { status_id: targetStatus.id, ...(revert_to_ready ? { tour_id: null } : {}) },
        });
        await tx.orderHistory.create({
          data: {
            order_id:   stop.order_id,
            status_id:  targetStatus.id,
            changed_by: null,
            note:       `Échec livraison${failure_reason ? ' : ' + failure_reason : ''}${driver_notes ? ' — ' + driver_notes : ''}`,
          },
        });
      }
    }

    // Auto-complete tour if all stops done
    const allStops = await tx.tourStop.findMany({ where: { tour_id: stop.tour_id } });
    const allDone  = allStops.every(s => s.id === stop_id ? true : ['delivered', 'failed', 'skipped'].includes((s.status?.code ?? '').toLowerCase()));
    if (allDone) {
      const completedId = await h.getTourStatusId('completed');
      await tx.tour.update({ where: { id: stop.tour_id }, data: { status_id: completedId } });
    }
  });

  return prisma.tourStop.findUnique({ where: { id: stop_id }, include: STOP_INCLUDE });
}

// ── Complete tour manually ────────────────────────────────────────────────────
async function completeTour(tour_id) {
  const tour = await getTour(tour_id);
  checkTourStatus(tour, 'in_progress');
  const pending = tour.stops.filter(s => ['pending', 'arrived', 'in_progress'].includes(s.status.code.toLowerCase()));
  if (pending.length > 0) throw { statusCode: 422, message: `${pending.length} stop(s) non traités` };
  const completedId = await h.getTourStatusId('completed');
  await prisma.tour.update({ where: { id: tour_id }, data: { status_id: completedId } });
  return getTour(tour_id);
}

// ── Driver list (for assign) ──────────────────────────────────────────────────
async function listDrivers({ node_id } = {}) {
  return prisma.driver.findMany({
    where: { is_active: true, is_deleted: false, ...(node_id ? { node_id } : {}) },
    select: { id: true, name: true, phone_country: true, phone_number: true, vehicle_type: true, vehicle_plate: true, node_id: true, node: { select: { name_fr: true } } },
    orderBy: { name: 'asc' },
  });
}

// ── Meta ──────────────────────────────────────────────────────────────────────
async function getMeta() {
  const [statuses, nodes, stopStatuses] = await Promise.all([
    prisma.tourStatus.findMany({ orderBy: { code: 'asc' } }),
    prisma.node.findMany({ where: { is_active: true, is_deleted: false }, select: { id: true, name_fr: true, code: true } }),
    prisma.stopStatus.findMany({ orderBy: { code: 'asc' } }),
  ]);
  return { statuses, nodes, stop_statuses: stopStatuses };
}

module.exports = {
  listReadyHomeOrders, listTours, createTour, getTour, assignDriver,
  addOrdersToTour, removeStop, startTour,
  arriveStop, deliverStop, failStop, completeTour,
  listDrivers, getMeta,
};
