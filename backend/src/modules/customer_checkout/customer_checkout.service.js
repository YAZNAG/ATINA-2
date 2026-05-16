/**
 * Customer-facing checkout service.
 * Reuses core logic from the admin checkout.service.js but:
 *  - accepts sku_code (from catalog) instead of sku UUID
 *  - resolves sku_code → sku.id internally
 *  - uses req.customerId instead of req.body.customer_id
 */
const prisma    = require('../../config/database');
const checkoutSvc = require('../checkout/checkout.service');
const repo      = require('../checkout/checkout.repository');

// ── Resolve sku_code → sku UUID ───────────────────────────────────────────────
// Cart items from the mobile app carry sku_code (article.sku_code),
// but the stock and order systems use sku.id (UUID).
async function resolveCartItems(cart_items) {
  if (!cart_items?.length) return [];

  const codes = cart_items.map(i => i.sku_code || i.sku_id).filter(Boolean);

  // Fetch skus by article.sku_code (supports both UUID sku_id and code)
  const [byCode, byId] = await Promise.all([
    prisma.sku.findMany({
      where: { article: { sku_code: { in: codes } } },
      select: {
        id: true,
        article: { select: { sku_code: true, price: true, vat_rate: true, name_fr: true } },
      },
    }),
    // Also try direct sku.id lookup for UUID identifiers
    prisma.sku.findMany({
      where: { id: { in: codes } },
      select: {
        id: true,
        article: { select: { sku_code: true, price: true, vat_rate: true, name_fr: true } },
      },
    }),
  ]);

  const codeMap = Object.fromEntries(byCode.map(s => [s.article.sku_code, s]));
  const idMap   = Object.fromEntries(byId.map(s => [s.id, s]));

  return cart_items.map(item => {
    const identifier = item.sku_code || item.sku_id;
    const sku = codeMap[identifier] ?? idMap[identifier];
    return {
      ...item,
      sku_id:     sku?.id     ?? item.sku_id ?? null,
      unit_price: item.unit_price ?? Number(sku?.article?.price ?? 0),
      vat_rate:   item.vat_rate   ?? Number(sku?.article?.vat_rate ?? 20),
    };
  });
}

// ── Meta ──────────────────────────────────────────────────────────────────────
async function getMeta(node_id = null) {
  return checkoutSvc.getMeta(node_id);
}

// ── Eligible nodes (home delivery) ────────────────────────────────────────────
async function findEligibleNodes(address_id, cart_items, date) {
  const resolved = await resolveCartItems(cart_items);
  return checkoutSvc.findEligibleNodes(address_id, resolved, date);
}

// ── Pickup nodes ──────────────────────────────────────────────────────────────
async function findPickupNodes(cart_items, date) {
  const resolved = await resolveCartItems(cart_items);
  return checkoutSvc.findPickupNodes(resolved, date);
}

// ── Delivery slots ────────────────────────────────────────────────────────────
async function getDeliverySlots(params) {
  const { cart_items, ...rest } = params;
  const resolved = await resolveCartItems(cart_items || []);
  return checkoutSvc.getDeliverySlots({ ...rest, cart_items: resolved });
}

// ── Create order ──────────────────────────────────────────────────────────────
async function createOrder(customerId, payload) {
  const { cart_items, ...rest } = payload;
  const resolved = await resolveCartItems(cart_items || []);

  return checkoutSvc.createOrder({
    ...rest,
    customer_id: customerId,
    cart_items: resolved,
  });
}

module.exports = { getMeta, findEligibleNodes, findPickupNodes, getDeliverySlots, createOrder };
