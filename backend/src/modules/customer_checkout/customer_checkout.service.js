const prisma    = require('../../config/database');
const checkoutSvc = require('../checkout/checkout.service');
const { getPackWithItems } = require('../pack/pack.shared');
const { isUuid, assertPackAvailable } = require('../customer_cart/customer_cart.shared');

// distance en km entre 2 points GPS 
function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Normalise les lignes envoyées par l'app : l'identifiant peut être l'id du SKU,
 * son EAN-13 (scan — skus.ean13) ou son code SKU. Seuls les UUID valides sont
 * cherchés par id (un EAN passé à `id: { in }` ferait échouer Prisma).
 */
async function resolveCartItems(cart_items) {
  if (!cart_items?.length) return [];

  const codes = [...new Set(cart_items.map(i => i.sku_code || i.sku_id).filter(Boolean).map(String))];
  const uuids = codes.filter(isUuid);

  const skus = codes.length
    ? await prisma.sku.findMany({
        where: {
          is_deleted: false,
          OR: [
            ...(uuids.length ? [{ id: { in: uuids } }] : []),
            { ean13:    { in: codes } },
            { sku_code: { in: codes } },
          ],
        },
        select: { id: true, ean13: true, sku_code: true },
      })
    : [];

  const idMap   = Object.fromEntries(skus.map(s => [s.id, s]));
  const eanMap  = Object.fromEntries(skus.filter(s => s.ean13).map(s => [s.ean13, s]));
  const codeMap = Object.fromEntries(skus.map(s => [s.sku_code, s]));

  // Les drapeaux « échange de points » / « lot gagné » ne sont jamais acceptés depuis
  // cart_items (lignes payées) : ils passent par exchange_items / claim_play_ids,
  // contrôlés côté serveur à la confirmation.
  return cart_items.map(({ is_points_exchange, points_spent, game_play_id, ...item }) => {
    const identifier = String(item.sku_code || item.sku_id || '');
    const sku = idMap[identifier] ?? eanMap[identifier] ?? codeMap[identifier];
    return { ...item, sku_id: sku?.id ?? item.sku_id ?? null };
  });
}

/**
 * US-102 : refuse (409) la validation d'une commande contenant un pack indisponible
 * (supprimé, inactif, packs.is_available = false, plafond / stock insuffisant).
 * Nombre de packs par pack_id : ligne { pack_id } sans sku_id = qty packs ; lignes
 * composants (format panier de l'app) = qty / qty du composant dans la recette.
 */
async function assertCartPacksAvailable(cart_items) {
  const packIds = [...new Set((cart_items || []).filter(i => i.pack_id).map(i => String(i.pack_id)))];
  for (const packId of packIds) {
    const lines  = cart_items.filter(i => String(i.pack_id) === packId);
    const recipe = isUuid(packId) ? await getPackWithItems(packId) : null;
    const baseBySku = Object.fromEntries((recipe?.pack_items ?? []).map(it => [it.sku_id, Number(it.qty ?? 1)]));
    let count = 0;
    let headerCount = 0;
    for (const l of lines) {
      const qty = Number(l.qty || 1);
      if (!l.sku_id) { headerCount += qty; continue; }
      const base = baseBySku[l.sku_id] ?? 1;
      count = Math.max(count, base > 0 ? Math.round(qty / base) : qty);
    }
    await assertPackAvailable(packId, Math.max(1, count + headerCount));
  }
}

async function calculate(customerId, payload) {
  const { cart_items, ...rest } = payload;
  const resolved = await resolveCartItems(cart_items || []);
  return checkoutSvc.calculate({
    ...rest,
    customer_id: customerId,
    cart_items:  resolved,
  });
}

// Meta 
async function getMeta(node_id = null) {
  return checkoutSvc.getMeta(node_id);
}

//Eligible nodes (home delivery) 
async function findEligibleNodes(address_id, cart_items, date) {
  const resolved = await resolveCartItems(cart_items);
  return checkoutSvc.findEligibleNodes(address_id, resolved, date);
}


//Trie une liste de nodes par distance vs adresse par défaut du client
async function sortNodesByDistance(customerId, nodes) {
  if (!nodes?.length) return nodes;

  const defaultAddress = await prisma.address.findFirst({
    where:  { customer_id: customerId, is_default: true, is_deleted: false },
    select: { lat: true, lng: true },
  });

  let refLat = defaultAddress?.lat ? Number(defaultAddress.lat) : null;
  let refLng = defaultAddress?.lng ? Number(defaultAddress.lng) : null;
 
  if (refLat == null || refLng == null) {
    const customer = await prisma.customer.findUnique({
      where:  { id: customerId },
      select: { lat: true, lng: true },
    });
    if (customer?.lat && customer?.lng) {
      refLat = Number(customer.lat);
      refLng = Number(customer.lng);
    }
  }
 
  // ajoute la distance sur chaque node
  const withDistance = nodes.map((n) => {
    const nLat = n.lat != null ? Number(n.lat) : null;
    const nLng = n.lng != null ? Number(n.lng) : null;
    let distance = null;
    if (refLat != null && refLng != null && nLat != null && nLng != null) {
      distance = haversineKm(refLat, refLng, nLat, nLng);
    }
    return { ...n, distance };
  });
 
  // trie : plus proche d'abord, ceux sans distance à la fin
  withDistance.sort((a, b) => {
    if (a.distance == null && b.distance == null) return 0;
    if (a.distance == null) return 1;
    if (b.distance == null) return -1;
    return a.distance - b.distance;
  });
 
  return withDistance;
}

// Pickup nodes
async function findPickupNodes(customerId, cart_items, date) {
  const resolved = await resolveCartItems(cart_items);
  const result   = await checkoutSvc.findPickupNodes(resolved, date);

  if (result?.eligible?.length) {
    result.eligible = await sortNodesByDistance(customerId, result.eligible);
  }
  return result;
}

// Delivery slots
async function getDeliverySlots(params) {
  const { cart_items, ...rest } = params;
  const resolved = await resolveCartItems(cart_items || []);
  return checkoutSvc.getDeliverySlots({ ...rest, cart_items: resolved });
}

// Create order
/**
 * Payload app : cart_items (lignes payées : produits, packs, ventes flash)
 *   + exchange_items: [{ sku_id, qty }]  → lignes « échange de points » (WF #19)
 *   + claim_play_ids: [play_id]          → lots gagnés free_sku / free_pack (WF #9)
 * Les deux derniers ne sont écrits qu'à la confirmation (checkout.createOrder).
 */
async function createOrder(customerId, payload) {
  const { cart_items, slot_id, ...rest } = payload;
  const resolved = await resolveCartItems(cart_items || []);

  // Contrôle de disponibilité des packs AVANT la création (le module checkout
  // incrémente ensuite packs.sold_count dans sa transaction via adjustPackSoldCount).
  await assertCartPacksAvailable(resolved);

  const order = await checkoutSvc.createOrder({
    ...rest,
    customer_id:      customerId,
    cart_items:       resolved,
    selected_slot_id: slot_id || null,   
    initial_status_code: 'confirmed',
  });

  const { notifyOrderConfirmed } = require('../../utils/notify');
  notifyOrderConfirmed(customerId, order.id, order.id.slice(0, 8).toUpperCase()).catch(e => console.error('[order] notify failed:', e));

  return order;
}

module.exports = { getMeta, findEligibleNodes, findPickupNodes, getDeliverySlots, createOrder, calculate };
