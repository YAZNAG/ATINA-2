const prisma    = require('../../config/database');
const checkoutSvc = require('../checkout/checkout.service');
const repo      = require('../checkout/checkout.repository');

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

async function resolveCartItems(cart_items) {
  if (!cart_items?.length) return [];

  const codes = cart_items.map(i => i.sku_code || i.sku_id).filter(Boolean);

  const [byCode, byId] = await Promise.all([
    prisma.sku.findMany({
      where: { article: { sku_code: { in: codes } } },
      select: {
        id: true,
        article: {
          select: {
            sku_code: true, price: true, vat_rate: true, name_fr: true,
            tax: { select: { rate: true } },
          },
        },
      },
    }),
    prisma.sku.findMany({
      where: { id: { in: codes } },
      select: {
        id: true,
        article: {
          select: {
            sku_code: true, price: true, vat_rate: true, name_fr: true,
            tax: { select: { rate: true } },
          },
        },
      },
    }),
  ]);

  const codeMap = Object.fromEntries(byCode.map(s => [s.article.sku_code, s]));
  const idMap   = Object.fromEntries(byId.map(s => [s.id, s]));

  return cart_items.map(item => {
  const identifier = item.sku_code || item.sku_id;
  const sku = codeMap[identifier] ?? idMap[identifier];
  return { ...item, sku_id: sku?.id ?? item.sku_id ?? null };  
});
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

  console.log('[DEBUG] findPickupNodes appelé, customerId:', customerId); 
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
async function createOrder(customerId, payload) {
  const { cart_items, slot_id, ...rest } = payload;
  const resolved = await resolveCartItems(cart_items || []);

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
