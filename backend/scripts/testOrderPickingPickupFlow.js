/**
 * Scénarios d’intégration picking + retrait magasin (services directs, DB réelle).
 * Lancez depuis backend/ : node scripts/testOrderPickingPickupFlow.js
 * Variables optionnelles : ORDER_ID (UUID commande existante en confirmed pour tests 1–9)
 */
const prisma = require('../src/config/database');
const orderMgmt = require('../src/modules/orders_mgmt/order_mgmt.service');
const pickingSvc = require('../src/modules/picking/picking.service');

let failures = 0;
function ok(name, condition, detail) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL  [${name}]`, detail || '');
  } else {
    console.log(`OK    [${name}]`);
  }
}

async function expectReject(name, fn, expectedStatus) {
  try {
    await fn();
    ok(name, false, 'attendait une erreur');
  } catch (e) {
    ok(name, e.statusCode === expectedStatus, `status ${e.statusCode} (attendu ${expectedStatus}) — ${e.message}`);
  }
}

async function main() {
  console.log('=== testOrderPickingPickupFlow (DB) ===\n');

  const confirmed = await prisma.order.findFirst({
    where: { is_deleted: false, status: { code: 'confirmed' } },
    include: { node: true, items: { take: 1 }, status: true, delivery_type: true },
  });

  const pickersSame = confirmed
    ? await prisma.picker.findMany({ where: { node_id: confirmed.node_id, is_active: true, is_deleted: false }, take: 2 })
    : [];
  const pickerOther = await prisma.picker.findFirst({
    where: { is_active: true, is_deleted: false, node_id: { not: confirmed?.node_id } },
  });

  // 2 — Picker autre node → refus
  if (confirmed && pickerOther) {
    await expectReject('picker autre node refusé', () => orderMgmt.assignPicker(confirmed.id, pickerOther.id), 422);
  } else {
    console.log('SKIP  [picker autre node] — besoin commande confirmed + picker autre node');
  }

  // 3 — Picker inactif
  if (confirmed && pickersSame[0]) {
    const inactive = await prisma.picker.findFirst({ where: { id: { not: pickersSame[0].id }, is_deleted: true } });
    if (inactive) {
      await expectReject('picker inactif refusé', () => orderMgmt.assignPicker(confirmed.id, inactive.id), 404);
    } else {
      console.log('SKIP  [picker inactif] — aucun picker supprimé en base');
    }
  }

  const orderIdEnv = process.env.ORDER_ID;
  let order = orderIdEnv
    ? await prisma.order.findFirst({
        where: { id: orderIdEnv, is_deleted: false, status: { code: 'confirmed' } },
        include: { node: true },
      })
    : confirmed;

  if (!order || !pickersSame[0]) {
    console.log('\nSKIP flux complet (1,4–9) — définissez ORDER_ID=<uuid confirmed> ou créez une commande confirmed + pickers sur le même node.');
    await prisma.$disconnect();
    process.exit(failures ? 1 : 0);
  }

  // Nettoyage session existante pour rejouer le flux sur la même commande (dev uniquement)
  await prisma.pickingSession.deleteMany({ where: { order_id: order.id } });
  const stConfirmed = await prisma.orderStatus.findFirst({ where: { code: 'confirmed' } });
  if (stConfirmed) {
    await prisma.order.update({ where: { id: order.id }, data: { status_id: stConfirmed.id } });
  }

  const pickerId = pickersSame[0].id;

  // 1 — Affecter picker
  let session;
  try {
    session = await orderMgmt.assignPicker(order.id, pickerId);
    ok('assign picker (confirmed → picking + session)', !!session?.id && session.picker_id === pickerId);
  } catch (e) {
    ok('assign picker', false, e.message);
    await prisma.$disconnect();
    process.exit(1);
  }

  // 4–5 session + items
  const fullSession = await prisma.pickingSession.findUnique({
    where: { id: session.id },
    include: { items: true, status: true },
  });
  ok('session picking créée', !!fullSession, 'session null');
  ok('items picking créés', (fullSession?.items?.length ?? 0) > 0, 'aucun item');

  // Double assign → 409
  await expectReject('double session refusée', () => orderMgmt.assignPicker(order.id, pickerId), 409);

  // 6 — Start session
  try {
    await pickingSvc.startSession(session.id, { changed_by: null });
    const s2 = await prisma.pickingSession.findUnique({ where: { id: session.id }, include: { status: true } });
    ok('start session → in_progress', s2?.status?.code === 'in_progress');
  } catch (e) {
    ok('start session', false, e.message);
  }

  // Complete sans finir items → 422
  await expectReject('complete avec items pending refusé', () => pickingSvc.completeSession(session.id), 422);

  // 7 — Pick first item
  const s3 = await prisma.pickingSession.findUnique({
    where: { id: session.id },
    include: { items: { include: { status: true } } },
  });
  const pendingItem = s3?.items?.find((i) => i.status?.code === 'pending');
  if (pendingItem) {
    try {
      await pickingSvc.pickItem(pendingItem.id, { qty_picked: Number(pendingItem.qty_expected) });
      ok('pick item', true);
    } catch (e) {
      ok('pick item', false, e.message);
    }
  }

  // Résoudre les autres lignes (substitute / oos / pick)
  const s4 = await prisma.pickingSession.findUnique({
    where: { id: session.id },
    include: { items: { include: { status: true } } },
  });
  for (const it of s4?.items ?? []) {
    if (it.status?.code !== 'pending') continue;
    try {
      await pickingSvc.substituteItem(it.id);
    } catch {
      try {
        await pickingSvc.outOfStock(it.id);
      } catch {
        await pickingSvc.pickItem(it.id, { qty_picked: Number(it.qty_expected) });
      }
    }
  }

  // 8–9 — Complete → ready
  try {
    await pickingSvc.completeSession(session.id);
    const ord = await prisma.order.findUnique({ where: { id: order.id }, include: { status: true } });
    ok('complete session → commande ready', ord?.status?.code === 'ready');
  } catch (e) {
    ok('complete session', false, e.message);
  }

  // 10–14 pickup : besoin pickup + ready + stock — skip si pas pickup
  const ordReady = await prisma.order.findFirst({
    where: { id: order.id, status: { code: 'ready' }, delivery_type: { code: 'pickup' } },
    include: { items: true, payments: { include: { payment_method: true, status: true } }, delivery_type: true },
  });
  if (!ordReady) {
    console.log('SKIP  [10–14 pickup] — commande de test non "ready" + pickup (changer delivery_type ou flux métier).');
  } else {
    await expectReject('pickup sans payment_collected', () => orderMgmt.confirmPickup(ordReady.id, { payment_collected: false }), 422);
    try {
      await orderMgmt.confirmPickup(ordReady.id, {
        payment_collected: true,
        note: 'Commande retirée au magasin (test script)',
      });
      const delivered = await prisma.order.findUnique({
        where: { id: ordReady.id },
        include: { status: true, payments: { include: { status: true } } },
      });
      const pay = delivered?.payments?.[0];
      ok('pickup → delivered + paiement collecté', delivered?.status?.code === 'delivered' && pay?.status?.code === 'collected');
      const hist = await prisma.orderHistory.findMany({ where: { order_id: ordReady.id }, orderBy: { created_at: 'asc' } });
      ok('historique présent', hist.length >= 2);
    } catch (e) {
      ok('confirm pickup', false, e.message);
    }
  }

  console.log(`\nTerminé — ${failures} échec(s).`);
  await prisma.$disconnect();
  process.exit(failures ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
