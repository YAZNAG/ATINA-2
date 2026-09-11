/**
 * Étape « commandes » : ~80 commandes sur 4 nodes et 30 jours, passées et avancées
 * UNIQUEMENT par les services métier (checkout / customer_checkout, orders_mgmt,
 * picking, delivery_mgmt, pickup, loyalty, gamification, quality, customers).
 *
 * Phases : A historique (J-28 → J-2, antidaté) · B parties de jeux · C ajustements de
 * points · D commandes du jour (tous statuts, tournées planifiée / en cours) ·
 * E contrôles qualité · F clôtures (vente flash terminée, parrainages, blocages).
 * Repère d'idempotence : « [DEMO:<clé>] » en tête de orders.notes / tours.notes.
 */
const { customerList } = require('./clients');
const { FLASH } = require('./offres');
const { RUPTURE, NOT_SELLABLE, AWAITING_SKU } = require('../data/scenario.data');
const { rng, seedOf, daysAgo, dateOnly, addMinutes, sleep } = require('../lib/util');

const S = (p) => require(`../../../src/${p}`);

// ─── Plan des commandes ───────────────────────────────────────────────────────
// c = index du client dans la liste du node · d = jours avant aujourd'hui · h = heure
const PLAN = {
  'CASA-MAARIF': [
    { k: 'H01', c: 3, d: 27, h: 11, min: 110 },
    { k: 'H02', c: 5, d: 26, h: 18, pack: 'PDJ', min: 110 },
    { k: 'H03', c: 0, d: 24, h: 10, coupon: 'BIENVENUE10', min: 140 },
    { k: 'H04', c: 1, d: 22, h: 19, coupon: 'VIP', min: 120 },
    { k: 'H05', c: 2, d: 20, h: 12, bo: true },
    { k: 'H06', c: 9, d: 19, h: 16, bo: true, cancelAt: 'pending', reason: 'Client injoignable : commande non confirmée' },
    { k: 'H07', c: 4, d: 17, h: 20, coupon: 'FLASH50', min: 280 },
    { k: 'H08', c: 6, d: 15, h: 13, sub: true },
    { k: 'H09', c: 7, d: 12, h: 17, pickup: true },
    { k: 'H10', c: 8, d: 10, h: 9, coupon: 'LIVRAISON0' },
    { k: 'H11', c: 2, d: 8, h: 15, cancelAt: 'confirmed', reason: 'Rupture fournisseur sur plusieurs articles' },
    { k: 'H12', c: 0, d: 6, h: 19, pack: 'APERO' },
    { k: 'H13', c: 9, d: 4, h: 12 },
    { k: 'H14', c: 3, d: 3, h: 20 },
    { k: 'A01', c: 1, bo: true, target: 'pending' },
    { k: 'A02', c: 0, exchange: [['EAU-SAL-150', 1], ['BIS-BIM-TON', 1]], target: 'confirmed' },
    { k: 'A03', c: 4, claim: true, flash: ['JUS-JAO-ORA', 1], target: 'confirmed' },
    { k: 'A04', c: 6, sub: true, target: 'confirmed' },
    { k: 'A05', c: 7, target: 'picking' },
    { k: 'A06', c: 8, target: 'picking', pickHalf: true },
    { k: 'A07', c: 2, target: 'ready', tour: 'planned' },
    { k: 'A08', c: 4, target: 'in_delivery', tour: 'progress', stop: 'delivered' },
    { k: 'A09', c: 5, target: 'in_delivery', tour: 'progress', stop: 'failed' },
    { k: 'A10', c: 3, target: 'in_delivery', tour: 'progress', stop: 'arrived', flash: ['JUS-JAO-ORA', 1] },
    { k: 'A11', c: 7, target: 'awaiting_stock' },
    { k: 'A12', c: 8, pickup: true, target: 'ready' },
  ],
  'CASA-AINSEBAA': [
    { k: 'H01', c: 2, d: 28, h: 18, pack: 'FTOUR', min: 110 },
    { k: 'H02', c: 0, d: 25, h: 11, coupon: 'ATINA20', min: 170 },
    { k: 'H03', c: 1, d: 19, h: 19, flash: ['EAU-SAL-PK6', 1] },
    { k: 'H04', c: 3, d: 16, h: 12, flash: ['EAU-SAL-PK6', 1] },
    { k: 'H05', c: 4, d: 14, h: 10, bo: true },
    { k: 'H06', c: 5, d: 11, h: 17, pickup: true },
    { k: 'H07', c: 6, d: 9, h: 20, pack: 'MENAGE' },
    { k: 'H08', c: 7, d: 7, h: 13, coupon: 'FLASH50', min: 280 },
    { k: 'H09', c: 0, d: 5, h: 16, cancelAt: 'picking', reason: 'Adresse de livraison erronée, client non joignable' },
    { k: 'H10', c: 1, d: 2, h: 12 },
    { k: 'A01', c: 2, bo: true, target: 'pending' },
    { k: 'A02', c: 3, target: 'confirmed' },
    { k: 'A03', c: 4, target: 'picking', pickHalf: true },
    { k: 'A04', c: 5, target: 'ready', tour: 'planned' },
    { k: 'A05', c: 6, target: 'in_delivery', tour: 'progress', stop: 'delivered' },
    { k: 'A06', c: 7, target: 'in_delivery', tour: 'progress', stop: 'pending' },
    { k: 'A07', c: 1, target: 'awaiting_stock' },
  ],
  'RABAT-AGDAL': [
    { k: 'H01', c: 4, d: 27, h: 12, coupon: 'RABAT15', min: 150 },
    { k: 'H02', c: 6, d: 25, h: 19, pack: 'BEBE', min: 110 },
    { k: 'H03', c: 0, d: 23, h: 10, bo: true },
    { k: 'H04', c: 1, d: 21, h: 18, pickup: true },
    { k: 'H05', c: 2, d: 18, h: 13, coupon: 'BIENVENUE10', min: 140 },
    { k: 'H06', c: 3, d: 16, h: 20, coupon: 'ATINA20', min: 170 },
    { k: 'H07', c: 5, d: 13, h: 11, add: true },
    { k: 'H08', c: 7, d: 11, h: 17, cancelAt: 'ready', reason: 'Le client a annulé par téléphone' },
    { k: 'H09', c: 8, d: 9, h: 12, pickup: true },
    { k: 'H10', c: 9, d: 7, h: 19, coupon: 'LIVRAISON0' },
    { k: 'H11', c: 0, d: 4, h: 14, cancelAt: 'confirmed', reason: 'Doublon de commande' },
    { k: 'H12', c: 2, d: 2, h: 18 },
    { k: 'A01', c: 1, bo: true, target: 'pending' },
    { k: 'A02', c: 3, exchange: [['RAI-CEN-JAM', 2], ['HER-MEN-BOT', 1]], target: 'confirmed' },
    { k: 'A03', c: 5, claim: true, target: 'confirmed' },
    { k: 'A04', c: 8, pack: 'PDJ', target: 'confirmed' },
    { k: 'A05', c: 9, target: 'picking', pickHalf: true },
    { k: 'A06', c: 7, pickup: true, target: 'ready' },
    { k: 'A07', c: 4, target: 'in_delivery', tour: 'progress', stop: 'arrived' },
    { k: 'A08', c: 6, target: 'in_delivery', tour: 'progress', stop: 'pending' },
    { k: 'A09', c: 5, exchange: [['YAO-CEN-DUP', 1]], target: 'cancelled', cancelAt: 'confirmed', reason: 'Le client a changé d’avis (points d’échange rendus)' },
    { k: 'A10', c: 0, target: 'awaiting_stock' },
  ],
  'MRK-GUELIZ': [
    { k: 'H01', c: 2, d: 26, h: 12, min: 110 },
    { k: 'H02', c: 0, d: 24, h: 18, pickup: true, pack: 'TAJINE' },
    { k: 'H03', c: 1, d: 21, h: 11, pack: 'THE' },
    { k: 'H04', c: 3, d: 17, h: 17, bo: true, slotBo: true },
    { k: 'H05', c: 4, d: 14, h: 19, pickup: true },
    { k: 'H06', c: 5, d: 10, h: 12, coupon: 'LIVRAISON0' },
    { k: 'H07', c: 7, d: 8, h: 16, bo: true, cancelAt: 'pending', reason: 'Commande saisie en double' },
    { k: 'H08', c: 6, d: 5, h: 13, pickup: true },
    { k: 'H09', c: 7, d: 3, h: 19 },
    { k: 'A01', c: 0, bo: true, slotBo: true, target: 'pending' },
    { k: 'A02', c: 1, target: 'confirmed' },
    { k: 'A03', c: 3, target: 'picking' },
    { k: 'A04', c: 4, pickup: true, target: 'ready' },
    { k: 'A05', c: 5, target: 'awaiting_stock' },
  ],
};

const PACK_NAMES = { PDJ: 'Pack petit-déjeuner', APERO: 'Pack apéro', FTOUR: 'Pack ftour Ramadan', MENAGE: 'Pack grand ménage', BEBE: 'Pack bébé', THE: 'Pack thé à la menthe', TAJINE: 'Pack tajine du vendredi' };
const CLIENT_NOTES = ['Merci de sonner deux fois', 'Livrer au gardien si absent', 'Appeler 5 minutes avant', 'Sans sac plastique svp', null, null, 'Porte bleue au fond de l’impasse', 'Paiement en espèces, prévoir la monnaie'];
const BLOCKS = [['CASA-MAARIF', 9, 'Refus répétés de commandes à la livraison (3 fois en un mois)'], ['MRK-GUELIZ', 7, 'Litige en cours : suspicion de fraude au code promo']];
const POINTS_ADJ = [
  ['CASA-MAARIF', 0, 150, 'Geste commercial : retard de livraison du mois dernier'],
  ['RABAT-AGDAL', 3, 150, 'Geste commercial : produit manquant lors d’une commande'],
  ['RABAT-AGDAL', 5, 120, 'Bonus fidélité : cliente ambassadrice du quartier'],
  ['CASA-MAARIF', 3, -10, 'Correction : points crédités en double'],
];
const OFFSETS = [0, 6, 14, 15, 36, 37, 58, 92, 93, 94, 95, 96];

async function run(ctx) {
  const { prisma } = ctx;
  const req = ctx.dry ? { user: { id: null } } : await ctx.req();
  const adminId = req.user.id;

  const checkout = S('modules/checkout/checkout.service');
  const custCheckout = S('modules/customer_checkout/customer_checkout.service');
  const orders = S('modules/orders_mgmt/order_mgmt.service');
  const picking = S('modules/picking/picking.service');
  const delivery = S('modules/delivery_mgmt/delivery.service');
  const pickup = S('modules/pickup/pickup.service');
  const loyalty = S('modules/loyalty/loyalty.service');
  const ledger = S('modules/loyalty/points-ledger.service');
  const engine = S('modules/gamification/gamification.engine');
  const quality = S('modules/quality/quality.service');
  const customers = S('modules/customers/customer.service');
  const { createPickingSessionForOrder } = S('utils/createPickingSession.helper');

  const nodes = await ctx.nodes();
  const skus = await ctx.skus();
  const skuById = Object.fromEntries(skus.map((s) => [s.id, s]));
  const skuByCode = Object.fromEntries(skus.map((s) => [s.code, s]));
  const clients = customerList();
  const custRows = await prisma.customer.findMany({ where: { phone_number: { in: clients.map((c) => c.phone) }, is_deleted: false }, include: { addresses: { where: { is_deleted: false }, orderBy: { created_at: 'asc' } } } });
  const custByPhone = Object.fromEntries(custRows.map((c) => [c.phone_number, c]));

  // Existants (idempotence)
  const existing = await prisma.order.findMany({ where: { notes: { startsWith: '[DEMO:' } }, select: { id: true, notes: true } });
  const existingKeys = new Set(existing.map((o) => o.notes.slice(6, o.notes.indexOf(']'))));
  if (ctx.dry) {
    let n = 0;
    for (const node of nodes) for (const s of PLAN[node.code]) if (!existingKeys.has(`${node.short}-${s.k}`)) n += 1;
    ctx.count('orders', n);
    return;
  }

  const nctx = {};
  for (const node of nodes) {
    const nodeClients = clients.filter((c) => c.node === node.code).map((c) => ({ ...c, row: custByPhone[c.phone] }));
    const rules = await prisma.sellingRule.findMany({ where: { node_id: node.id } });
    const ruleBySku = Object.fromEntries(rules.map((r) => [r.sku_id, r]));
    const flashCodes = FLASH.filter((f) => f.node === node.code && f.sku).map((f) => f.sku);
    const excluded = new Set([...(RUPTURE[node.code] || []), ...(NOT_SELLABLE[node.code] || []), ...flashCodes, AWAITING_SKU[node.code]]);
    const pool = skus.filter((s) => s.status === 'active' && !excluded.has(s.code) && ruleBySku[s.id]?.is_sellable)
      .map((s) => ({ s, price: Number(ruleBySku[s.id].price) }));
    const packs = await prisma.pack.findMany({ where: { node_id: node.id, is_deleted: false } });
    const slots = await prisma.deliverySlot.findMany({ where: { node_id: node.id, is_active: true }, orderBy: [{ specific_date: 'asc' }, { slot_start: 'asc' }] });
    const [pickers, drivers] = await Promise.all([
      prisma.picker.findMany({ where: { node_id: node.id, is_active: true, is_deleted: false }, orderBy: { phone_number: 'asc' } }),
      prisma.driver.findMany({ where: { node_id: node.id, is_active: true, is_deleted: false }, orderBy: { phone_number: 'asc' } }),
    ]);
    const manager = await prisma.backofficeAdmin.findFirst({ where: { node_id: node.id } });
    nctx[node.code] = { node, clients: nodeClients, pool, ruleBySku, packs, slots, pickers, drivers, managerId: manager?.user_id ?? adminId };
  }

  const r = rng(seedOf('commandes'));
  const newlyCreated = []; // { id, key, node, spec, T0 }
  const sessionsDone = [];

  // ─── Helpers ────────────────────────────────────────────────────────────
  const stockMap = async (nodeId) => {
    const lv = await prisma.stockLevel.findMany({ where: { node_id: nodeId }, select: { sku_id: true, qty_available: true } });
    return Object.fromEntries(lv.map((l) => [l.sku_id, Number(l.qty_available)]));
  };

  async function buildCart(nc, spec, minTotal) {
    const stock = await stockMap(nc.node.id);
    const items = [];
    let total = 0;
    const want = Math.max(minTotal, Number(nc.node.min_order_amount) + 15) + r.int(10, 90);
    for (const { s, price } of r.shuffle(nc.pool)) {
      if (total >= want && items.length >= 3) break;
      if (items.length >= 7 && total >= minTotal + 10) break;
      if (items.length >= 14) break;
      let qty = s.unit_sale === 'KG' ? r.int(1, 2) : r.int(1, 3);
      if (price > 60) qty = 1;
      if ((stock[s.id] || 0) < qty + 2) continue;
      items.push({ sku_id: s.id, qty });
      total += price * qty;
    }
    return { items, total };
  }

  function slotFor(nc, T0, { after = 1 } = {}) {
    const day = dateOnly(T0);
    const localHour = (T0.getUTCHours() + 1) % 24;
    const list = nc.slots.filter((s) => s.specific_date.toISOString().slice(0, 10) === day);
    if (!list.length) return [];
    const idx = list.findIndex((s) => Number(s.slot_start.slice(0, 2)) >= localHour + after);
    const i = idx >= 0 ? idx : list.length - 1;
    return [list[i], list[Math.min(i + 1, list.length - 1)]].filter((v, j, a) => a.indexOf(v) === j);
  }

  async function createOrderFor(nc, spec, T0) {
    const client = nc.clients[spec.c];
    if (!client?.row) throw new Error(`client ${spec.c} absent`);
    const cust = client.row;
    const address = cust.addresses.find((a) => a.is_default) || cust.addresses[0];
    const { items } = await buildCart(nc, spec, spec.min || 0);
    const cart = [...items];
    if (spec.pack) {
      const pack = nc.packs.find((p) => p.name_fr === PACK_NAMES[spec.pack]);
      if (pack) cart.push({ pack_id: pack.id, qty: 1 });
      else ctx.warn(`${nc.node.short}-${spec.k} : pack ${spec.pack} absent`);
    }
    if (spec.flash) {
      const s = skuByCode[spec.flash[0]];
      // Une ligne flash par client (le contrôle max_qty_per_user compte aussi la commande en cours).
      const already = s ? await prisma.orderItem.count({ where: { sku_id: s.id, flash_sale_id: { not: null }, order: { customer_id: cust.id } } }) : 1;
      if (s && !already) cart.push({ sku_id: s.id, qty: spec.flash[1] });
    }
    if (spec.target === 'awaiting_stock') {
      const s = skuByCode[AWAITING_SKU[nc.node.code]];
      if (s) cart.push({ sku_id: s.id, qty: 2 });
    }
    let promo = null;
    if (spec.coupon === 'VIP') promo = `VIP-${client.referral_code}`;
    else if (spec.coupon) promo = spec.coupon;

    const note = `[DEMO:${nc.node.short}-${spec.k}] ${r.pick(CLIENT_NOTES) || 'Commande de démonstration'}`;
    const home = !spec.pickup;
    const base = {
      node_id: nc.node.id, delivery_type_code: home ? 'home' : 'pickup', address_id: home ? address.id : null,
      payment_method_code: 'cod', notes: note, promo_code: promo,
    };
    if (spec.exchange) base.exchange_items = spec.exchange.map(([code, qty]) => ({ sku_id: skuByCode[code].id, qty }));
    if (spec.claimIds?.length) base.claim_play_ids = spec.claimIds;

    const slots = home && nc.node.slot_selection_enabled ? slotFor(nc, T0) : [];
    let order;
    if (spec.bo) {
      order = await checkout.createOrder({
        ...base, customer_id: cust.id, cart_items: cart, selected_slot_id: slots[0]?.id || null,
        initial_status_code: 'pending',
      }, { source: 'backoffice', req });
    } else {
      order = await custCheckout.createOrder(cust.id, {
        ...base, cart_items: cart, slot_id: slots[0]?.id || null, slot_preference_ids: slots.map((s) => s.id),
      });
    }
    return order;
  }

  async function pickFull(nc, orderId, { half = false, openOnly = false } = {}) {
    const picker = nc.pickers[r.int(0, nc.pickers.length - 1)];
    const session = await createPickingSessionForOrder(orderId, picker.id, adminId, `le picker ${picker.name} (affectation back-office)`);
    if (openOnly) return session;
    await picking.startSession(session.id, { picker_id: picker.id, changed_by: adminId });
    const items = session.items || [];
    const toPick = half ? items.slice(0, Math.ceil(items.length / 2)) : items;
    for (const it of toPick) {
      await picking.pickItem(it.id, { qty_picked: Number(it.qty_expected), scanned_ean: it.order_item?.sku?.ean13 || undefined });
    }
    if (!half) {
      await picking.completeSession(session.id, adminId);
      sessionsDone.push({ id: session.id, node: nc.node, orderId });
    }
    return session;
  }

  /** Amène une commande créée jusqu'à l'état visé (hors tournée). */
  async function advance(nc, spec, order) {
    const id = order.id;
    const status = () => prisma.order.findUnique({ where: { id }, select: { status: { select: { code: true } } } }).then((o) => o.status.code);
    if (spec.cancelAt === 'pending') return orders.cancel(id, spec.reason, req);
    if ((await status()) === 'pending' && spec.target !== 'pending') await orders.changeStatus(id, 'confirmed', req);
    if (spec.target === 'pending') {
      if (spec.slotBo) await assignSlotBo(nc, id, true);
      return null;
    }
    if (spec.slotBo) await assignSlotBo(nc, id, false, spec.T0);
    if (spec.sub) {
      const full = await prisma.orderItem.findMany({ where: { order_id: id, parent_item_id: null, pack_id: null, is_points_exchange: false, game_play_id: null, sku_id: { not: null } } });
      const line = full[0];
      const used = new Set(full.map((l) => l.sku_id));
      const repl = nc.pool.find((p) => p.s.sub === skuById[line.sku_id].sub && !used.has(p.s.id)) || nc.pool.find((p) => !used.has(p.s.id));
      await orders.substituteItem(id, line.id, { sku_id: repl.s.id, qty: Number(line.qty), reason: 'Rupture constatée en rayon : produit équivalent proposé au client' }, req);
    }
    if (spec.add) {
      const used = new Set((await prisma.orderItem.findMany({ where: { order_id: id } })).map((l) => l.sku_id));
      const extra = nc.pool.find((p) => p.s.sub.startsWith('BOI-EAU') && !used.has(p.s.id)) || nc.pool.find((p) => !used.has(p.s.id));
      await orders.addItem(id, { sku_id: extra.s.id, qty: 1, reason: 'Ajout demandé par le client au téléphone' }, req);
    }
    if (spec.cancelAt === 'confirmed') return orders.cancel(id, spec.reason, req);
    if (spec.target === 'confirmed') return null;
    if (spec.target === 'awaiting_stock') return orders.changeStatus(id, 'awaiting_stock', req);
    if (spec.target === 'picking') return pickFull(nc, id, { half: !!spec.pickHalf, openOnly: !spec.pickHalf });
    if (spec.cancelAt === 'picking') {
      await pickFull(nc, id, { half: true });
      return orders.cancel(id, spec.reason, req);
    }
    await pickFull(nc, id);
    if (spec.cancelAt === 'ready') return orders.cancel(id, spec.reason, req);
    if (spec.pickup && spec.target !== 'ready') {
      const o = await prisma.order.findUnique({ where: { id }, select: { total_ttc: true } });
      await pickup.collectCOD(id, { amount_collected: Number(o.total_ttc), payment_note: 'Encaissé au comptoir' }, adminId, req);
      await pickup.confirmPickup(id, { note: 'Commande retirée au point de vente' }, adminId, req);
    }
    return null;
  }

  async function assignSlotBo(nc, orderId, nextDay, T0 = new Date()) {
    const day = dateOnly(nextDay ? new Date(Date.now() + 86400000) : T0);
    const slot = nc.slots.find((s) => s.specific_date.toISOString().slice(0, 10) === day);
    if (slot) await orders.updateSlot(orderId, slot.id, req);
  }

  async function deliverTour(nc, orderIds, { T, marker, label, mode = 'completed', stops = {} }) {
    if (!orderIds.length) return null;
    const existingTour = await prisma.tour.findFirst({ where: { notes: { startsWith: marker } } });
    if (existingTour) return existingTour;
    const driver = nc.drivers[r.int(0, nc.drivers.length - 1)];
    const localH = (T.getUTCHours() + 1) % 24;
    const tour = await delivery.createTour({
      node_id: nc.node.id, driver_id: driver.id, date: dateOnly(T),
      slot_start: `${String(localH).padStart(2, '0')}:00`, slot_end: `${String(Math.min(23, localH + 2)).padStart(2, '0')}:00`,
      zone: nc.node.quartier, notes: `${marker} ${label}`, order_ids: orderIds,
    }, req);
    ctx.count('tours');
    if (mode === 'planned') return tour;
    await delivery.startTour(tour.id, req);
    const full = await delivery.getTour(tour.id);
    for (const stop of full.stops) {
      const want = mode === 'completed' ? 'delivered' : (stops[stop.order_id] || 'pending');
      if (want === 'delivered') {
        const o = await prisma.order.findUnique({ where: { id: stop.order_id }, select: { total_ttc: true } });
        await delivery.deliverStop(stop.id, { cod_collected: true, amount_collected: Number(o.total_ttc), driver_notes: 'Remis en main propre' }, req);
      } else if (want === 'failed') {
        await delivery.failStop(stop.id, { failure_reason: 'Client absent', driver_notes: 'Deux appels sans réponse', revert_to_ready: true }, req);
      } else if (want === 'arrived') {
        await delivery.arriveStop(stop.id, { driver_notes: 'Devant l’immeuble' });
      }
    }
    return tour;
  }

  /** Antidate commande, historique, paiement, picking, arrêts, notifications. */
  async function antedate(orderId, T0) {
    const hist = await prisma.orderHistory.findMany({ where: { order_id: orderId }, orderBy: [{ created_at: 'asc' }] });
    const cap = Date.now() - 60000; // commandes du jour : jamais d'horodatage futur
    const at = (m) => { const t = addMinutes(T0, m); return t.getTime() > cap ? new Date(cap) : t; };
    let last = T0;
    for (const [i, h] of hist.entries()) {
      last = addMinutes(T0, OFFSETS[i] ?? (96 + i));
      if (last.getTime() > cap) last = new Date(cap - (hist.length - i) * 20000);
      await prisma.orderHistory.update({ where: { id: h.id }, data: { created_at: last } });
    }
    const o = await prisma.order.findUnique({ where: { id: orderId } });
    await prisma.order.update({ where: { id: orderId }, data: { created_at: T0, updated_at: last, ...(o.cod_collected_at ? { cod_collected_at: last } : {}) } });
    for (const p of await prisma.payment.findMany({ where: { order_id: orderId } })) {
      await prisma.payment.update({ where: { id: p.id }, data: { created_at: T0, updated_at: last, ...(p.collected_at ? { collected_at: last } : {}) } });
    }
    for (const s of await prisma.pickingSession.findMany({ where: { order_id: orderId } })) {
      await prisma.pickingSession.update({ where: { id: s.id }, data: { created_at: at(14), ...(s.started_at ? { started_at: at(15) } : {}), ...(s.completed_at ? { completed_at: at(36) } : {}) } });
      const items = await prisma.pickingSessionItem.findMany({ where: { session_id: s.id, picked_at: { not: null } } });
      for (const [i, it] of items.entries()) await prisma.pickingSessionItem.update({ where: { id: it.id }, data: { picked_at: at(17 + i * 2) } });
    }
    await prisma.couponRedemption.updateMany({ where: { order_id: orderId }, data: { redeemed_at: T0 } });
    await prisma.orderSlotPreference.updateMany({ where: { order_id: orderId }, data: { created_at: T0, updated_at: T0 } });
    for (const st of await prisma.tourStop.findMany({ where: { order_id: orderId } })) {
      await prisma.tourStop.update({ where: { id: st.id }, data: { created_at: at(55), ...(st.arrived_at ? { arrived_at: addMinutes(last, -3) } : {}), ...(st.delivered_at ? { delivered_at: last } : {}) } });
    }
    const notifs = await prisma.notification.findMany({ where: { order_id: orderId }, orderBy: { created_at: 'asc' } });
    for (const [i, n] of notifs.entries()) {
      const t = at(OFFSETS[i] ?? 90 + i);
      await prisma.notification.update({ where: { id: n.id }, data: { created_at: t, sent_at: t } });
    }
    await prisma.referral.updateMany({ where: { qualifying_order_id: orderId, validated_at: { not: null } }, data: { validated_at: last } });
    return last;
  }

  // ─── Phase A : historique ─────────────────────────────────────────────────
  await sleep(300);
  const hist = [];
  for (const node of nodes) {
    for (const spec of PLAN[node.code]) {
      if (!spec.k.startsWith('H')) continue;
      hist.push({ node, spec: { ...spec, T0: daysAgo(spec.d, spec.h, r.int(0, 50)) } });
    }
  }
  const days = [...new Set(hist.map((h) => h.spec.d))].sort((a, b) => b - a);
  for (const d of days) {
    for (const node of nodes) {
      const nc = nctx[node.code];
      const group = hist.filter((h) => h.node.code === node.code && h.spec.d === d);
      const toTour = [];
      const created = [];
      for (const { spec } of group) {
        const key = `${node.short}-${spec.k}`;
        if (existingKeys.has(key)) continue;
        try {
          const order = await createOrderFor(nc, spec, spec.T0);
          ctx.count('orders');
          created.push({ id: order.id, spec, key });
          await advance(nc, spec, order);
          if (!spec.pickup && !spec.cancelAt) toTour.push(order.id);
        } catch (e) {
          ctx.warn(`Commande ${key} : ${e.message}`);
        }
      }
      if (toTour.length) {
        const T = addMinutes(group[0].spec.T0, 55);
        try {
          const tour = await deliverTour(nc, toTour, { T, marker: `[DEMO:TOUR:${node.short}:J${d}]`, label: `Tournée du ${dateOnly(T)}` });
          if (tour) {
            await prisma.tour.update({ where: { id: tour.id }, data: { created_at: T, planned_at: T, updated_at: addMinutes(T, 45) } });
          }
        } catch (e) { ctx.warn(`Tournée ${node.short} J-${d} : ${e.message}`); }
      }
      for (const c of created) { await antedate(c.id, c.spec.T0); newlyCreated.push(c); }
    }
  }

  // Parrainages : validation à la 1re livraison (déclenchée en asynchrone par les services ; rejouée ici)
  await sleep(1500);
  for (const c of newlyCreated) {
    const o = await prisma.order.findUnique({ where: { id: c.id }, select: { customer_id: true, status: { select: { code: true } } } });
    if (o.status.code === 'delivered') await loyalty.validateReferralOnDelivery(o.customer_id, c.id);
  }
  for (const c of newlyCreated) await prisma.referral.updateMany({ where: { qualifying_order_id: c.id, validated_at: { not: null } }, data: { validated_at: addMinutes(c.spec.T0, 100) } });

  // Vente flash « terminée » : fenêtre ramenée dans le passé après ses commandes
  for (const f of FLASH.filter((x) => x.endedDaysAgo)) {
    const node = nodes.find((n) => n.code === f.node);
    const fs = node && await prisma.flashSale.findFirst({ where: { node_id: node.id, name_fr: f.name_fr, is_deleted: false } });
    if (fs && new Date(fs.ends_at) > new Date()) {
      await prisma.flashSale.update({ where: { id: fs.id }, data: { starts_at: daysAgo(-f.start, 8, 0), ends_at: daysAgo(f.endedDaysAgo, 23, 0), is_active: false } });
    }
  }

  // ─── Phase B : parties de jeux ───────────────────────────────────────────
  const games = await prisma.gamificationGame.findMany({ where: { is_deleted: false, is_active: true, node_id: { in: nodes.map((n) => n.id) } }, include: { unlock_condition: true, prizes: { include: { prize_type: true } } } });
  // Idempotence : seules les commandes historiques créées par CE lancement ouvrent des parties.
  const phaseA = new Set(newlyCreated.map((c) => c.id));
  const OUTCOMES = {
    order_delivered: ['free_sku', 'points', 'no_prize', 'coupon', 'free_pack', 'points', 'no_prize', 'coupon', 'points', 'free_sku', 'no_prize', 'points'],
    first_order: ['free_sku', 'points', 'coupon', 'no_prize', 'free_pack', 'points', 'no_prize', 'coupon', 'points', 'no_prize'],
  };
  for (const game of games) {
    const cond = game.unlock_condition?.code;
    const seq = OUTCOMES[cond] || [];
    let turn = await prisma.gamificationPlay.count({ where: { game_id: game.id } });
    let candidates = [];
    if (cond === 'order_delivered') {
      candidates = await prisma.order.findMany({ where: { node_id: game.node_id, is_deleted: false, status: { code: 'delivered' }, total_ttc: { gte: Number(game.unlock_min_amount || 0) } }, orderBy: { created_at: 'asc' }, select: { id: true, customer_id: true } });
    } else if (cond === 'first_order') {
      const all = await prisma.order.findMany({ where: { node_id: game.node_id, is_deleted: false, status: { code: { notIn: ['cancelled', 'returned'] } } }, orderBy: { created_at: 'asc' }, select: { id: true, customer_id: true } });
      const seen = new Set();
      candidates = all.filter((o) => (seen.has(o.customer_id) ? false : seen.add(o.customer_id)));
    }
    for (const o of candidates.filter((x) => phaseA.has(x.id))) {
      const elig = await engine.checkEligibility(o.customer_id, game.id, { orderId: o.id });
      if (!elig.eligible) continue;
      // Tirage ciblé : même ordre de lots que le moteur (requête identique juste avant la partie)
      const fresh = await prisma.gamificationGame.findFirst({ where: { id: game.id }, include: { prizes: { include: { prize_type: { select: { code: true } } } } } });
      const pool = fresh.prizes.filter((p) => p.is_active && !p.is_deleted && !(p.stock_limit != null && p.awarded_count >= p.stock_limit));
      const want = seq[turn % seq.length];
      const total = pool.reduce((s, p) => s + Number(p.probability_weight), 0);
      let acc = 0; let value = r();
      for (const p of pool) {
        if (p.prize_type.code === want) { value = (acc + Number(p.probability_weight) / 2) / total; break; }
        acc += Number(p.probability_weight);
      }
      try {
        await engine.play(o.customer_id, game.id, { orderId: o.id, rng: () => value });
        ctx.count('gamification_plays');
        turn += 1;
      } catch (e) { ctx.warn(`Partie ${game.name_fr} : ${e.message}`); }
    }
  }

  // ─── Phase C : ajustements manuels de points ─────────────────────────────
  for (const [nodeCode, ci, amount, reason] of POINTS_ADJ) {
    const cust = nctx[nodeCode]?.clients[ci]?.row;
    if (!cust) continue;
    if (await prisma.pointsTransaction.findFirst({ where: { customer_id: cust.id, reason } })) continue;
    const bal = (await prisma.customer.findUnique({ where: { id: cust.id }, select: { points_balance: true } })).points_balance;
    if (amount < 0 && bal < -amount) continue;
    try { await ledger.adjust(req, cust.id, { amount, reason }); ctx.count('points_transactions (ajustements)'); } catch (e) { ctx.warn(`Ajustement points : ${e.message}`); }
  }

  // ─── Phase D : commandes du jour ─────────────────────────────────────────
  for (const node of nodes) {
    const nc = nctx[node.code];
    const specs = PLAN[node.code].filter((s) => s.k.startsWith('A'));
    const tours = { planned: [], progress: [] };
    const stopWant = {};
    let minutesAgo = 330;
    for (const base of specs) {
      const spec = { ...base, T0: new Date(Date.now() - minutesAgo * 60000) };
      minutesAgo -= r.int(12, 28);
      const key = `${node.short}-${spec.k}`;
      if (existingKeys.has(key)) continue;
      if (spec.claim) {
        const game = games.find((g) => g.node_id === node.id);
        const plays = game ? await prisma.gamificationPlay.findMany({ where: { game_id: game.id, result: 'win', claimed_at: null, expires_at: { gt: new Date() }, prize: { prize_type: { code: { in: ['free_sku', 'free_pack'] } } } }, orderBy: { played_at: 'asc' } }) : [];
        if (plays.length) {
          const winner = plays[0].customer_id;
          spec.claimIds = plays.filter((p) => p.customer_id === winner).map((p) => p.id);
          const idx = nc.clients.findIndex((c) => c.row?.id === winner);
          if (idx >= 0) spec.c = idx;
        } else ctx.warn(`${key} : aucun lot gagné à réclamer`);
      }
      try {
        const order = await createOrderFor(nc, spec, spec.T0);
        ctx.count('orders');
        const coreSpec = spec.tour ? { ...spec, target: 'ready' } : spec;
        await advance(nc, coreSpec, order);
        if (spec.target === 'cancelled' && !spec.cancelAt) await orders.cancel(order.id, spec.reason, req);
        if (spec.tour) { tours[spec.tour].push(order.id); if (spec.stop) stopWant[order.id] = spec.stop; }
        newlyCreated.push({ id: order.id, spec, key, today: true });
      } catch (e) { ctx.warn(`Commande ${key} : ${e.message}`); }
    }
    try {
      if (tours.planned.length) await deliverTour(nc, tours.planned, { T: new Date(Date.now() + 3600000), marker: `[DEMO:TOUR:${node.short}:PLAN]`, label: 'Tournée de fin de journée', mode: 'planned' });
      if (tours.progress.length) await deliverTour(nc, tours.progress, { T: new Date(Date.now() - 3600000), marker: `[DEMO:TOUR:${node.short}:COURS]`, label: 'Tournée en cours', mode: 'progress', stops: stopWant });
    } catch (e) { ctx.warn(`Tournées du jour ${node.short} : ${e.message}`); }
    for (const c of newlyCreated.filter((x) => x.today && x.key.startsWith(`${node.short}-`))) await antedate(c.id, c.spec.T0);
  }

  // ─── Phase E : contrôles qualité ─────────────────────────────────────────
  const TYPES = ['picking_accuracy', 'packaging', 'temperature', 'expiry'];
  const KO = { picking_accuracy: 'Un article manquant détecté au contrôle', packaging: 'Sac déchiré, produits reconditionnés', temperature: 'Produit frais relevé à 7 °C au départ', expiry: 'DLC à J+1 sur un yaourt, remplacé' };
  let q = 0;
  for (const s of sessionsDone) {
    q += 1;
    if (q % 2 === 0 && q % 3 !== 0) continue;
    const marker = `[DEMO:QC:${s.id.slice(0, 8)}]`;
    if (await prisma.qualityCheck.findFirst({ where: { notes: { startsWith: marker } } })) continue;
    const type = TYPES[q % TYPES.length];
    const ko = q % 5 === 0;
    try {
      const qc = await quality.create({
        check_type: type, picking_session_id: s.id, result: ko ? 'ko' : 'ok', score: ko ? 55 + r.int(0, 15) : 85 + r.int(0, 15),
        anomalies: ko ? KO[type] : null, notes: `${marker} Contrôle ${ko ? 'non conforme, action corrective faite' : 'conforme'}`,
      }, nctx[s.node.code].managerId);
      const sess = await prisma.pickingSession.findUnique({ where: { id: s.id }, select: { completed_at: true } });
      if (sess?.completed_at && qc?.id) await prisma.qualityCheck.update({ where: { id: qc.id }, data: { created_at: addMinutes(sess.completed_at, 2) } });
      ctx.count('quality_checks');
    } catch (e) { ctx.warn(`Contrôle qualité : ${e.message}`); }
  }

  // ─── Phase F : blocages ──────────────────────────────────────────────────
  for (const [nodeCode, ci, reason] of BLOCKS) {
    const cust = nctx[nodeCode]?.clients[ci]?.row;
    if (!cust) continue;
    const fresh = await prisma.customer.findUnique({ where: { id: cust.id }, select: { is_active: true } });
    if (!fresh.is_active) continue;
    try { await customers.block(req, cust.id, { reason }); ctx.count('clients bloqués'); } catch (e) { ctx.warn(`Blocage : ${e.message}`); }
  }
  await sleep(1500); // notifications / validations asynchrones des services
}

module.exports = { name: 'commandes', label: 'Commandes, préparation, tournées, jeux, qualité', run, PLAN };
