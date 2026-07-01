/**
 * simulate-delivery.js
 *
 * Simule la chaîne complète de livraison pour une commande donnée :
 *   confirmed → picking → ready → in_delivery → delivered
 *
 * Usage :
 *   node simulate-delivery.js <order_id>
 *   node simulate-delivery.js <order_id> --cod   (si paiement COD)
 */

const prisma    = require('./src/config/database');
const pickingSvc = require('./src/modules/picking/picking.service');
const deliverySvc = require('./src/modules/delivery_mgmt/delivery.service');
const { createPickingSessionForOrder } = require('./src/utils/createPickingSession.helper');

const ORDER_ID = process.argv[2];
const IS_COD   = process.argv.includes('--cod');

if (!ORDER_ID) {
  console.error('\nUsage: node simulate-delivery.js <order_id> [--cod]\n');
  process.exit(1);
}

// ── Couleurs console ──────────────────────────────────────────────────────────
const ok   = (msg) => console.log(`  ✓  ${msg}`);
const info = (msg) => console.log(`  →  ${msg}`);
const sep  = ()    => console.log('─'.repeat(55));

// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  sep();
  console.log(`  SIMULATION LIVRAISON`);
  console.log(`  Commande : ${ORDER_ID}`);
  sep();

  // ── 1. Charger la commande ─────────────────────────────────────────────────
  const order = await prisma.order.findUnique({
    where: { id: ORDER_ID },
    include: {
      status:        { select: { code: true, name_fr: true } },
      delivery_type: { select: { code: true } },
      node:          { select: { id: true, name_fr: true } },
      items:         true,
      payments:      { take: 1, orderBy: { created_at: 'desc' }, include: { payment_method: { select: { code: true } } } },
    },
  });

  if (!order) { console.error(`\n  ✗  Commande introuvable : ${ORDER_ID}\n`); process.exit(1); }

  info(`Client node  : ${order.node?.name_fr}`);
  info(`Statut actuel: ${order.status.name_fr} (${order.status.code})`);
  info(`Livraison    : ${order.delivery_type?.code}`);
  info(`Articles     : ${order.items.length}`);
  info(`Total        : ${order.total_ttc} MAD`);
  sep();

  const nodeId = order.node_id;

  // ── 2 & 3 & 4. Picking ───────────────────────────────────────────────────
  const currentCode = order.status.code.toLowerCase();

  if (currentCode === 'confirmed' || currentCode === 'picking') {
    const picker = await prisma.picker.findFirst({
      where: { node_id: nodeId, is_active: true, is_deleted: false },
    });

    if (picker) {
      // ── Flux picking complet ──────────────────────────────────────────────
      info(`Picker trouvé : ${picker.name}`);
      let sessionId;

      if (currentCode === 'confirmed') {
        info('Création session picking...');
        const session = await createPickingSessionForOrder(ORDER_ID, picker.id, null, `[simulate] ${picker.name}`);
        sessionId = session.id;
        ok(`Session picking créée : ${sessionId.slice(0, 8)}…`);
        await pickingSvc.startSession(sessionId, { picker_id: picker.id });
        ok('Session démarrée (in_progress)');
      } else {
        const existing = await prisma.pickingSession.findFirst({
          where: { order_id: ORDER_ID, status: { code: { in: ['open', 'in_progress', 'OPEN', 'IN_PROGRESS'] } } },
          include: { items: { include: { status: true } } },
        });
        if (existing) {
          sessionId = existing.id;
          info(`Session picking existante : ${sessionId.slice(0, 8)}…`);
          if (existing.status?.code.toLowerCase() === 'open') {
            await pickingSvc.startSession(sessionId);
            ok('Session démarrée (in_progress)');
          }
        }
      }

      if (sessionId) {
        info('Traitement des articles...');
        const session = await pickingSvc.getSession(sessionId);
        const pending = session.items.filter(i => i.status.code.toLowerCase() === 'pending');
        for (const item of pending) {
          await pickingSvc.pickItem(item.id, { qty_picked: Number(item.qty_expected) });
        }
        ok(`${pending.length} article(s) marqués "picked"`);
        await pickingSvc.completeSession(sessionId, null);
        ok('Session complétée → commande READY');
      }
    } else {
      // ── Pas de picker → on bypasse le picking directement ────────────────
      info('Aucun picker configuré — picking bypassed (simulation)');
      const readyStatus = await prisma.orderStatus.findFirst({
        where: { code: { equals: 'ready', mode: 'insensitive' } },
      });
      if (!readyStatus) { console.error('  ✗  Statut "ready" introuvable'); process.exit(1); }
      await prisma.order.update({
        where: { id: ORDER_ID },
        data:  { status_id: readyStatus.id },
      });
      await prisma.orderHistory.create({
        data: { order_id: ORDER_ID, status_id: readyStatus.id, changed_by: null, note: '[SIMULATION] picking bypassed — commande prête' },
      });
      ok('Commande passée directement à READY');
    }
  }

  // ── 5. Trouver un driver disponible ───────────────────────────────────────
  let tourId, stopId;

  // Recharger le statut de la commande (avec tour_id)
  const freshOrder = await prisma.order.findUnique({
    where: { id: ORDER_ID },
    include: { status: true },
  });

  const statusCode = freshOrder.status.code.toLowerCase();

  if (statusCode === 'ready') {
    // Vérifier si une tournée existe déjà pour cette commande
    if (freshOrder.tour_id) {
      info(`Tournée existante détectée : ${freshOrder.tour_id.slice(0, 8)}…`);
      tourId = freshOrder.tour_id;
      const existingTour = await prisma.tour.findUnique({
        where: { id: tourId },
        include: { status: true, stops: true },
      });
      stopId = existingTour.stops.find(s => s.order_id === ORDER_ID)?.id;

      // Assigner un driver si absent
      if (!existingTour.driver_id) {
        const driver = await prisma.driver.findFirst({
          where: { node_id: nodeId, is_active: true, is_deleted: false },
        });
        if (driver) {
          await prisma.tour.update({ where: { id: tourId }, data: { driver_id: driver.id } });
          info(`Driver assigné : ${driver.name}`);
        }
      }

      // Démarrer si encore planifiée
      if (existingTour.status.code.toLowerCase() === 'planned') {
        await deliverySvc.startTour(tourId);
        ok('Tournée démarrée → commande IN_DELIVERY');
      } else {
        info(`Tournée déjà au statut : ${existingTour.status.name_fr}`);
      }
    } else {
      // Créer une nouvelle tournée
      const driver = await prisma.driver.findFirst({
        where: { node_id: nodeId, is_active: true, is_deleted: false },
      });
      if (!driver) {
        console.error(`  ✗  Aucun driver actif dans le node "${order.node?.name_fr}"`);
        console.error(`     Créez un driver via l'admin avant de relancer.\n`);
        process.exit(1);
      }
      info(`Driver trouvé : ${driver.name} (${driver.vehicle_type ?? 'véhicule inconnu'})`);

      info('Création de la tournée...');
      const tour = await deliverySvc.createTour({
        node_id:   nodeId,
        driver_id: driver.id,
        order_ids: [ORDER_ID],
        notes:     '[simulate] tournée de test',
      });
      tourId = tour.id;
      stopId = tour.stops[0]?.id;
      ok(`Tournée créée : ${tourId.slice(0, 8)}…`);

      await deliverySvc.startTour(tourId);
      ok('Tournée démarrée → commande IN_DELIVERY');
    }
  } else if (statusCode === 'in_delivery') {
    // Tournée déjà démarrée, trouver le stop
    const stop = await prisma.tourStop.findFirst({
      where: { order_id: ORDER_ID },
      include: { status: true },
    });
    if (!stop || ['delivered', 'failed'].includes(stop.status.code.toLowerCase())) {
      console.error('  ✗  Aucun stop actif pour cette commande');
      process.exit(1);
    }
    stopId = stop.id;
    tourId = stop.tour_id;
    info(`Stop existant : ${stopId.slice(0, 8)}…`);
  }

  // ── 6. Livrer directement (arriveStop ignoré — statut "arrived" absent du seed) ──
  if (stopId) {
    // ── 7. Livrer ─────────────────────────────────────────────────────────────
    const paymentMethod = order.payments?.[0]?.payment_method?.code;
    const isCod = IS_COD || paymentMethod === 'cod';

    await deliverySvc.deliverStop(stopId, {
      cod_collected:    isCod,
      amount_collected: isCod ? Number(order.total_ttc) : undefined,
      driver_notes:     '[simulate] livraison effectuée',
      note:             '[SIMULATION] livraison confirmée',
    });
    ok('Stop : DELIVERED');
  }

  // ── 8. Résumé final ────────────────────────────────────────────────────────
  sep();
  const final = await prisma.order.findUnique({
    where: { id: ORDER_ID },
    include: {
      status:   { select: { code: true, name_fr: true } },
      customer: { select: { name: true, points_balance: true } },
    },
  });

  console.log(`  ✓  SIMULATION TERMINÉE`);
  console.log(`     Statut final : ${final.status.name_fr} (${final.status.code})`);
  console.log(`     Client       : ${final.customer?.name}`);
  console.log(`     Points       : ${final.customer?.points_balance} pts`);
  sep();
}

run()
  .catch(err => {
    console.error('\n  ✗  ERREUR :', err?.message ?? err);
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
