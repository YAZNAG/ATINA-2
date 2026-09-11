/**
 * Delivery management service — tournées & livreurs (WF #4, US-062 à US-065).
 * Cycle : ready → tournée planifiée → en cours → arrêts livrés / en échec → terminée
 *
 *  - l'ordre des arrêts = tour_stops.sort_order (consécutif, sans trou)
 *  - tours.order_count = nombre d'arrêts de la tournée (tenu à jour à chaque ajout / retrait)
 *  - un arrêt par commande et par tournée (UNIQUE (tour_id, order_id) contrôlé ici)
 */
const prisma = require('../../config/database');
const h      = require('../../utils/statusHelpers');
const { audit } = require('../../utils/audit');
const loyalty = require('../loyalty/loyalty.service');
const L = require('../orders_mgmt/order_lifecycle');
const { notifyInDelivery, notifyDelivered } = require('../../utils/notify');

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
      confirmed_slot: { select: { id: true, specific_date: true, slot_start: true, slot_end: true, name_fr: true } },
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

const CLOSED_TOUR = ['completed', 'cancelled'];
const DONE_STOP = ['delivered', 'failed', 'skipped'];
const lc = (v) => String(v ?? '').toLowerCase();

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getTour(id) {
  const tour = await prisma.tour.findUnique({ where: { id }, include: TOUR_INCLUDE });
  if (!tour) throw { statusCode: 404, message: 'Tournée introuvable' };
  const stops = tour.stops || [];
  return {
    ...tour,
    progress: {
      total: stops.length,
      delivered: stops.filter((s) => lc(s.status?.code) === 'delivered').length,
      failed: stops.filter((s) => lc(s.status?.code) === 'failed').length,
      arrived: stops.filter((s) => lc(s.status?.code) === 'arrived').length,
      pending: stops.filter((s) => !DONE_STOP.includes(lc(s.status?.code))).length,
    },
  };
}

function checkTourStatus(tour, expected) {
  const list = Array.isArray(expected) ? expected : [expected];
  if (!list.includes(lc(tour.status.code))) {
    throw { statusCode: 422, message: `Tournée au statut « ${tour.status.name_fr} » : action impossible.` };
  }
}

function assertNotClosed(tour) {
  if (CLOSED_TOUR.includes(lc(tour.status.code))) {
    throw { statusCode: 422, message: `Tournée « ${tour.status.name_fr} » : plus aucune modification possible.` };
  }
}

/** Itinéraire (route_json) : arrêts ordonnés avec coordonnées, recalculé après chaque changement. */
async function refreshRoute(tx, tour_id) {
  const stops = await tx.tourStop.findMany({
    where: { tour_id },
    orderBy: { sort_order: 'asc' },
    include: { order: { select: { id: true, address: { select: { lat: true, lng: true, street_name: true, city: true } } } } },
  });
  const route = stops.map((s) => ({
    stop_id: s.id,
    order_id: s.order_id,
    sort_order: s.sort_order,
    lat: s.order?.address?.lat != null ? Number(s.order.address.lat) : null,
    lng: s.order?.address?.lng != null ? Number(s.order.address.lng) : null,
    label: [s.order?.address?.street_name, s.order?.address?.city].filter(Boolean).join(', ') || null,
  }));
  await tx.tour.update({ where: { id: tour_id }, data: { route_json: route, order_count: stops.length } });
  return route;
}

async function validateDriver(driver_id, node_id) {
  const driver = await prisma.driver.findFirst({ where: { id: driver_id, is_active: true, is_deleted: false } });
  if (!driver) throw { statusCode: 404, message: 'Livreur introuvable ou inactif' };
  if (node_id && driver.node_id !== node_id) {
    throw { statusCode: 422, message: `Le livreur ${driver.name} n'est pas rattaché au nœud de la tournée` };
  }
  return driver;
}

/** Commandes éligibles à une tournée : livraison à domicile, prêtes, même nœud, sans tournée. */
async function eligibleOrders(order_ids, node_id) {
  const orders = await prisma.order.findMany({
    where: { id: { in: order_ids }, is_deleted: false, tour_id: null },
    include: { status: true, delivery_type: true },
  });
  return orders.filter((o) =>
    lc(o.status.code) === 'ready' && lc(o.delivery_type?.code) === 'home' && (!node_id || o.node_id === node_id));
}

// ── Ready home orders (not in any active tour) ────────────────────────────────
async function listReadyHomeOrders({ node_id, search, slot_id, date } = {}) {
  const where = {
    is_deleted:    false,
    status:        { code: 'ready' },
    delivery_type: { code: 'home' },
    tour_id:       null,
    ...(node_id ? { node_id } : {}),
    ...(slot_id ? { confirmed_slot_id: slot_id } : {}),
    ...(date ? { confirmed_slot: { is: { specific_date: new Date(`${date}T00:00:00.000Z`) } } } : {}),
  };
  if (search?.trim()) {
    const s = search.trim();
    where.OR = [
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
      confirmed_slot: { select: { id: true, specific_date: true, slot_start: true, slot_end: true, name_fr: true } },
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
async function listTours({ page = 1, limit = 25, status_code, node_id, driver_id, date } = {}) {
  const where = {};
  if (status_code) {
    const codes = String(status_code).split(',').map((c) => c.trim()).filter(Boolean);
    where.status = { code: codes.length > 1 ? { in: codes } : codes[0] };
  }
  if (node_id)   where.node_id   = node_id;
  if (driver_id) where.driver_id = driver_id;
  if (date)      where.date      = date;

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
async function createTour({ node_id, driver_id, date, slot_start, slot_end, zone, planned_at, notes, order_ids = [] } = {}, req = null) {
  if (!node_id) throw { statusCode: 400, message: 'Le nœud est obligatoire' };
  const node = await prisma.node.findFirst({ where: { id: node_id, is_active: true, is_deleted: false } });
  if (!node) throw { statusCode: 404, message: 'Nœud introuvable ou inactif' };
  if (driver_id) await validateDriver(driver_id, node_id);
  if (slot_start && slot_end && slot_start >= slot_end) throw { statusCode: 400, message: "L'heure de fin doit être après l'heure de début" };

  const ids = [...new Set(order_ids || [])];
  const validOrders = ids.length ? await eligibleOrders(ids, node_id) : [];
  if (ids.length && !validOrders.length) {
    throw { statusCode: 422, message: 'Aucune commande valide (livraison à domicile, prête, même nœud, sans tournée)' };
  }
  // Conserve l'ordre de sélection
  validOrders.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

  const [plannedStatusId, pendingStopId] = await Promise.all([
    h.getTourStatusId('planned'),
    h.getStopStatusId('pending'),
  ]);

  const tour = await prisma.$transaction(async (tx) => {
    const newTour = await tx.tour.create({
      data: {
        node_id, driver_id: driver_id || null,
        status_id:  plannedStatusId,
        planned_at: planned_at ? new Date(planned_at) : null,
        date: date || null,
        slot_start: slot_start || null,
        slot_end:   slot_end || null,
        zone:       zone?.trim() || null,
        notes:      notes?.trim() || null,
      },
    });
    for (let i = 0; i < validOrders.length; i++) {
      await tx.tourStop.create({ data: { tour_id: newTour.id, order_id: validOrders[i].id, status_id: pendingStopId, sort_order: i + 1 } });
      await tx.order.update({ where: { id: validOrders[i].id }, data: { tour_id: newTour.id } });
    }
    await refreshRoute(tx, newTour.id);
    await audit(req, {
      action: 'CREATE', resource: 'tours', resource_id: newTour.id,
      new_values: { node_id, driver_id: driver_id || null, date, slot_start, slot_end, zone, orders: validOrders.map((o) => o.id) },
    }, tx);
    return newTour;
  });

  return getTour(tour.id);
}

// ── Update tour info (date, plage, zone, notes) tant que non clôturée ────────
async function updateTour(tour_id, { date, slot_start, slot_end, zone, notes, planned_at } = {}, req = null) {
  const tour = await getTour(tour_id);
  assertNotClosed(tour);
  const data = {};
  if (date !== undefined)       data.date = date || null;
  if (slot_start !== undefined) data.slot_start = slot_start || null;
  if (slot_end !== undefined)   data.slot_end = slot_end || null;
  if (zone !== undefined)       data.zone = zone?.trim() || null;
  if (notes !== undefined)      data.notes = notes?.trim() || null;
  if (planned_at !== undefined) data.planned_at = planned_at ? new Date(planned_at) : null;
  const s = data.slot_start ?? tour.slot_start;
  const e = data.slot_end ?? tour.slot_end;
  if (s && e && s >= e) throw { statusCode: 400, message: "L'heure de fin doit être après l'heure de début" };
  await prisma.tour.update({ where: { id: tour_id }, data });
  await audit(req, {
    action: 'UPDATE', resource: 'tours', resource_id: tour_id,
    old_values: { date: tour.date, slot_start: tour.slot_start, slot_end: tour.slot_end, zone: tour.zone, notes: tour.notes },
    new_values: data,
  });
  return getTour(tour_id);
}

// ── Assign / reassign driver (tant que la tournée n'est pas clôturée) ────────
async function assignDriver(tour_id, driver_id, req = null) {
  const tour = await getTour(tour_id);
  assertNotClosed(tour);
  const driver = await validateDriver(driver_id, tour.node_id);
  if (tour.driver_id === driver_id) return tour;

  await prisma.tour.update({ where: { id: tour_id }, data: { driver_id } });
  await audit(req, {
    action: tour.driver_id ? 'REASSIGN_DRIVER' : 'ASSIGN_DRIVER',
    resource: 'tours', resource_id: tour_id,
    old_values: { driver_id: tour.driver_id, driver: tour.driver?.name ?? null },
    new_values: { driver_id, driver: driver.name },
  });
  return getTour(tour_id);
}

// ── Add orders to existing tour ───────────────────────────────────────────────
async function addOrdersToTour(tour_id, order_ids, req = null) {
  if (!Array.isArray(order_ids) || !order_ids.length) throw { statusCode: 400, message: 'Sélectionnez au moins une commande' };
  const tour = await getTour(tour_id);
  checkTourStatus(tour, 'planned');

  const pendingStopId = await h.getStopStatusId('pending');
  const already = new Set(tour.stops.map((s) => s.order_id));
  const valid = (await eligibleOrders([...new Set(order_ids)], tour.node_id)).filter((o) => !already.has(o.id));
  if (!valid.length) throw { statusCode: 422, message: 'Aucune commande valide à ajouter (prête, à domicile, même nœud, sans tournée)' };

  const maxSort = tour.stops.reduce((m, s) => Math.max(m, s.sort_order), 0);
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < valid.length; i++) {
      await tx.tourStop.create({ data: { tour_id, order_id: valid[i].id, status_id: pendingStopId, sort_order: maxSort + i + 1 } });
      await tx.order.update({ where: { id: valid[i].id }, data: { tour_id } });
    }
    const route = await refreshRoute(tx, tour_id);
    await audit(req, {
      action: 'ADD_STOP', resource: 'tours', resource_id: tour_id,
      old_values: { order_count: tour.stops.length },
      new_values: { added: valid.map((o) => o.id), order_count: route.length },
    }, tx);
  });
  return getTour(tour_id);
}

// ── Remove stop from planned tour ─────────────────────────────────────────────
async function removeStop(stop_id, req = null) {
  const stop = await prisma.tourStop.findUnique({ where: { id: stop_id }, include: { tour: { include: { status: true } } } });
  if (!stop) throw { statusCode: 404, message: 'Arrêt introuvable' };
  checkTourStatus(stop.tour, 'planned');
  await prisma.$transaction(async (tx) => {
    await L.removeStopTx(tx, stop, req, 'REMOVE_STOP');
    await refreshRoute(tx, stop.tour_id);
  });
  return getTour(stop.tour_id);
}

// ── Réordonner les arrêts (sort_order 1..n) ───────────────────────────────────
async function reorderStops(tour_id, stop_ids, req = null) {
  if (!Array.isArray(stop_ids) || !stop_ids.length) throw { statusCode: 400, message: 'Ordre des arrêts requis (stop_ids)' };
  const tour = await getTour(tour_id);
  assertNotClosed(tour);
  const current = tour.stops.map((s) => s.id);
  if (stop_ids.length !== current.length || !stop_ids.every((id) => current.includes(id)) || new Set(stop_ids).size !== stop_ids.length) {
    throw { statusCode: 400, message: "La liste doit contenir exactement tous les arrêts de la tournée" };
  }
  if (lc(tour.status.code) === 'in_progress') {
    // En cours : les arrêts déjà traités gardent leur position de tête
    const done = tour.stops.filter((s) => DONE_STOP.includes(lc(s.status?.code)));
    const moved = done.some((s) => stop_ids.indexOf(s.id) !== tour.stops.indexOf(s));
    if (moved) throw { statusCode: 422, message: 'Tournée en cours : seuls les arrêts non traités peuvent être réordonnés' };
  }
  await prisma.$transaction(async (tx) => {
    // Décalage temporaire pour éviter tout conflit, puis numérotation définitive
    for (let i = 0; i < stop_ids.length; i++) {
      await tx.tourStop.update({ where: { id: stop_ids[i] }, data: { sort_order: 1000 + i } });
    }
    for (let i = 0; i < stop_ids.length; i++) {
      await tx.tourStop.update({ where: { id: stop_ids[i] }, data: { sort_order: i + 1 } });
    }
    await refreshRoute(tx, tour_id);
    await audit(req, {
      action: 'REORDER_STOPS', resource: 'tours', resource_id: tour_id,
      old_values: { order: current }, new_values: { order: stop_ids },
    }, tx);
  });
  return getTour(tour_id);
}

// ── Start tour ────────────────────────────────────────────────────────────────
async function startTour(tour_id, req = null) {
  const tour = await getTour(tour_id);
  checkTourStatus(tour, 'planned');
  if (!tour.stops.length) throw { statusCode: 422, message: 'Aucun arrêt : ajoutez des commandes avant de démarrer' };
  if (!tour.driver_id) throw { statusCode: 422, message: 'Assignez un livreur avant de démarrer la tournée' };

  const [tourInProgressId, orderInDeliveryStatus] = await Promise.all([
    h.getTourStatusId('in_progress'),
    h.getOrderStatus('in_delivery'),
  ]);
  const userId = req?.user?.id ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.tour.update({ where: { id: tour_id }, data: { status_id: tourInProgressId, planned_at: tour.planned_at ?? new Date() } });
    for (const stop of tour.stops) {
      if (!stop.order_id) continue;
      await tx.order.update({ where: { id: stop.order_id }, data: { status_id: orderInDeliveryStatus.id } });
      await tx.orderHistory.create({
        data: { order_id: stop.order_id, status_id: orderInDeliveryStatus.id, changed_by: userId, note: `Tournée démarrée — commande en livraison${tour.driver?.name ? ' par ' + tour.driver.name : ''}` },
      });
    }
    await audit(req, { action: 'START_TOUR', resource: 'tours', resource_id: tour_id, old_values: { status: 'planned' }, new_values: { status: 'in_progress' } }, tx);
  });
  for (const stop of tour.stops) {
    if (stop.order?.customer_id) notifyInDelivery(stop.order.customer_id, stop.order_id).catch(() => {});
  }
  return getTour(tour_id);
}

// ── Arrive at stop ────────────────────────────────────────────────────────────
async function arriveStop(stop_id, { driver_notes } = {}) {
  const stop = await prisma.tourStop.findUnique({
    where: { id: stop_id },
    include: { tour: { include: { status: true } }, status: true },
  });
  if (!stop) throw { statusCode: 404, message: 'Arrêt introuvable' };
  if (lc(stop.tour.status.code) !== 'in_progress') throw { statusCode: 422, message: 'Tournée non démarrée' };
  if (DONE_STOP.includes(lc(stop.status.code))) throw { statusCode: 422, message: `Arrêt déjà ${stop.status.name_fr}` };

  const arrivedStatus = await h.getStopStatus('arrived') ?? await h.getStopStatus('in_progress');
  if (!arrivedStatus) throw { statusCode: 500, message: 'Statut arrêt « arrived » introuvable' };
  await prisma.tourStop.update({
    where: { id: stop_id },
    data:  { status_id: arrivedStatus.id, arrived_at: stop.arrived_at ?? new Date(), driver_notes: driver_notes ?? stop.driver_notes ?? null },
  });
  return prisma.tourStop.findUnique({ where: { id: stop_id }, include: STOP_INCLUDE });
}

async function autoCompleteIfDone(tx, tour_id) {
  const allStops = await tx.tourStop.findMany({ where: { tour_id }, include: { status: true } });
  if (allStops.length && allStops.every((s) => DONE_STOP.includes(lc(s.status?.code)))) {
    const completedId = await h.getTourStatusId('completed');
    await tx.tour.update({ where: { id: tour_id }, data: { status_id: completedId } });
  }
}

// ── Deliver stop ──────────────────────────────────────────────────────────────
async function deliverStop(stop_id, { cod_collected = false, amount_collected, driver_notes, note } = {}, req = null) {
  const stop = await prisma.tourStop.findUnique({
    where: { id: stop_id },
    include: {
      tour:  { include: { status: true, driver: { select: { id: true, name: true } } } },
      status: true,
      order: {
        include: {
          status:   true,
          payments: { take: 1, orderBy: { created_at: 'desc' }, include: { payment_method: { select: { code: true } }, status: { select: { code: true } } } },
        },
      },
    },
  });
  if (!stop) throw { statusCode: 404, message: 'Arrêt introuvable' };
  if (lc(stop.tour.status.code) !== 'in_progress') throw { statusCode: 422, message: 'Démarrez la tournée avant de livrer' };
  if (lc(stop.status.code) === 'delivered') throw { statusCode: 409, message: 'Arrêt déjà livré' };
  if (!stop.order_id || !stop.order) throw { statusCode: 422, message: 'Arrêt sans commande' };

  const order = stop.order;
  if (lc(order.status.code) !== 'in_delivery')
    throw { statusCode: 422, message: `Commande au statut « ${order.status.name_fr} » — attendu : en livraison` };

  const payment = order.payments?.[0];
  const isCOD   = lc(payment?.payment_method?.code) === 'cod';
  const alreadyCollected = lc(payment?.status?.code) === 'collected';
  if (isCOD && !cod_collected && !alreadyCollected)
    throw { statusCode: 422, message: 'Paiement à la livraison non encaissé — indiquez cod_collected: true et le montant' };
  if (isCOD && cod_collected && !alreadyCollected) {
    const total     = Number(order.total_ttc);
    const collected = Number(amount_collected ?? total);
    if (collected < total)
      throw { statusCode: 422, message: `Montant encaissé insuffisant (${collected} < ${total} MAD)` };
  }

  const [deliveredStopId, deliveredOrderId, collectedPayId] = await Promise.all([
    h.getStopStatusId('delivered'),
    h.getOrderStatusId('delivered'),
    h.getPaymentStatusId('collected'),
  ]);
  const now = new Date();
  const userId = req?.user?.id ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.tourStop.update({
      where: { id: stop_id },
      data: {
        status_id:        deliveredStopId,
        delivered_at:     now,
        arrived_at:       stop.arrived_at ?? now,
        cod_collected:    isCOD ? !!(cod_collected || alreadyCollected) : false,
        amount_collected: isCOD && cod_collected ? Number(amount_collected ?? order.total_ttc) : null,
        driver_notes:     driver_notes ?? null,
      },
    });

    // Encaissement COD remis au livreur (WF #30) — avant la sortie de stock pour ne pas créer de flottant
    if (isCOD && cod_collected && payment && lc(payment.status.code) === 'pending') {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status_id: collectedPayId,
          collected_at: now,
          collected_by: (stop.tour.driver?.name || 'Livreur').slice(0, 150),
          notes: driver_notes ?? null,
          metadata: {
            cod_collected_at:     now.toISOString(),
            cod_collected_amount: Number(amount_collected ?? order.total_ttc),
            cod_collected_by:     stop.tour.driver_id ?? null,
          },
        },
      });
      await audit(req, {
        action: 'COLLECT_PAYMENT', resource: 'payments', resource_id: payment.id,
        old_values: { status: 'pending', amount: Number(order.total_ttc) },
        new_values: {
          status: 'collected', order_id: order.id, collected_by: stop.tour.driver?.name || 'Livreur',
          collected_at: now, amount_collected: Number(amount_collected ?? order.total_ttc), tour_id: stop.tour_id,
        },
      }, tx);
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status_id: deliveredOrderId,
        ...(isCOD && cod_collected && !order.cod_collected_at ? { cod_collected_at: now } : {}),
      },
    });
    await tx.orderHistory.create({
      data: {
        order_id: order.id, status_id: deliveredOrderId, changed_by: userId,
        note: note?.trim() || `Livraison confirmée${stop.tour.driver?.name ? ' par ' + stop.tour.driver.name : ''}`,
      },
    });

    // Sortie de stock (WF #31) + points selon les règles actives
    await L.applyDeliveryStock(tx, order.id, req, 'Livraison domicile — vente');
    await loyalty.creditPointsOnDelivery(tx, order.customer_id, order, deliveredOrderId);

    await autoCompleteIfDone(tx, stop.tour_id);
  }, { timeout: 30000 });

  setImmediate(() => loyalty.validateReferralOnDelivery(order.customer_id, order.id).catch(() => {}));
  notifyDelivered(order.customer_id, order.id).catch(() => {});
  return prisma.tourStop.findUnique({ where: { id: stop_id }, include: STOP_INCLUDE });
}

// ── Fail stop ─────────────────────────────────────────────────────────────────
async function failStop(stop_id, { failure_reason, driver_notes, revert_to_ready = true } = {}, req = null) {
  // Motif attendu (US-065) ; valeur par défaut pour compatibilité avec l'app livreur
  const reason = String(failure_reason ?? '').trim() || 'Motif non précisé';
  const stop = await prisma.tourStop.findUnique({
    where: { id: stop_id },
    include: { tour: { include: { status: true } }, status: true, order: { include: { status: true } } },
  });
  if (!stop) throw { statusCode: 404, message: 'Arrêt introuvable' };
  if (lc(stop.tour.status.code) !== 'in_progress') throw { statusCode: 422, message: 'Tournée non démarrée' };
  if (lc(stop.status.code) === 'delivered') throw { statusCode: 422, message: 'Arrêt déjà livré' };

  const [failedStopId, readyStatusRow, inDeliveryRow] = await Promise.all([
    h.getStopStatusId('failed'),
    h.getOrderStatus('ready'),
    h.getOrderStatus('in_delivery'),
  ]);
  const userId = req?.user?.id ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.tourStop.update({
      where: { id: stop_id },
      data: { status_id: failedStopId, failure_reason: reason.slice(0, 100), driver_notes: driver_notes ?? null, arrived_at: stop.arrived_at ?? new Date() },
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
            order_id: stop.order_id, status_id: targetStatus.id, changed_by: userId,
            note: `Échec livraison : ${reason}${driver_notes ? ' — ' + driver_notes : ''}`,
          },
        });
      }
    }
    await audit(req, { action: 'FAIL_STOP', resource: 'tour_stops', resource_id: stop_id, old_values: { status: stop.status.code }, new_values: { status: 'failed', failure_reason: reason } }, tx);
    await autoCompleteIfDone(tx, stop.tour_id);
  });

  return prisma.tourStop.findUnique({ where: { id: stop_id }, include: STOP_INCLUDE });
}

// ── Clôturer la tournée ───────────────────────────────────────────────────────
async function completeTour(tour_id, req = null) {
  const tour = await getTour(tour_id);
  checkTourStatus(tour, 'in_progress');
  const pending = tour.stops.filter((s) => !DONE_STOP.includes(lc(s.status.code)));
  if (pending.length > 0) throw { statusCode: 422, message: `${pending.length} arrêt(s) non traité(s) : livrez-les ou déclarez un échec avant de clôturer` };
  const completedId = await h.getTourStatusId('completed');
  await prisma.tour.update({ where: { id: tour_id }, data: { status_id: completedId } });
  await audit(req, { action: 'COMPLETE_TOUR', resource: 'tours', resource_id: tour_id, old_values: { status: 'in_progress' }, new_values: { status: 'completed' } });
  return getTour(tour_id);
}

// ── Annuler une tournée planifiée (US-064) : arrêts retirés, commandes détachées ──
async function cancelTour(tour_id, { reason } = {}, req = null) {
  const tour = await getTour(tour_id);
  checkTourStatus(tour, 'planned');
  const cancelledId = await h.getTourStatusId('cancelled');
  await prisma.$transaction(async (tx) => {
    const stops = await tx.tourStop.findMany({ where: { tour_id }, orderBy: { sort_order: 'desc' } });
    for (const s of stops) await L.removeStopTx(tx, s, req, 'CANCEL_TOUR');
    await tx.tour.update({ where: { id: tour_id }, data: { status_id: cancelledId, order_count: 0, route_json: [], notes: reason ? `${tour.notes ? tour.notes + ' — ' : ''}Annulée : ${reason}` : tour.notes } });
    await audit(req, { action: 'CANCEL_TOUR', resource: 'tours', resource_id: tour_id, old_values: { status: 'planned', stops: stops.length }, new_values: { status: 'cancelled', reason: reason ?? null } }, tx);
  });
  return getTour(tour_id);
}

// ── Driver list (assignation) : disponibilité = tournées en cours / planifiées ──
async function listDrivers({ node_id } = {}) {
  const drivers = await prisma.driver.findMany({
    where: { is_active: true, is_deleted: false, ...(node_id ? { node_id } : {}) },
    select: {
      id: true, name: true, phone_country: true, phone_number: true, vehicle_type: true, vehicle_plate: true, node_id: true,
      node: { select: { name_fr: true, code: true } },
      tours: {
        where: { status: { code: { in: ['planned', 'in_progress'] } } },
        select: { id: true, date: true, slot_start: true, slot_end: true, order_count: true, status: { select: { code: true, name_fr: true } } },
      },
    },
    orderBy: { name: 'asc' },
  });
  return drivers.map((d) => ({
    ...d,
    active_tours: d.tours,
    tours_in_progress: d.tours.filter((t) => t.status.code === 'in_progress').length,
    tours_planned: d.tours.filter((t) => t.status.code === 'planned').length,
    is_available: !d.tours.some((t) => t.status.code === 'in_progress'),
  }));
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
  listReadyHomeOrders, listTours, createTour, updateTour, getTour, assignDriver,
  addOrdersToTour, removeStop, reorderStops, startTour,
  arriveStop, deliverStop, failStop, completeTour, cancelTour,
  listDrivers, getMeta,
};
