const prisma = require('../../config/database');
const repo   = require('./checkout.repository');

// ── Helpers ───────────────────────────────────────────────────────────────────

function targetDate(dateStr) {
  if (dateStr) return new Date(dateStr);
  const now = new Date();
  // Past 14h → propose next day
  if (now.getHours() >= 14) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }
  return now;
}

// ── Stock check for a node ────────────────────────────────────────────────────
async function checkStock(node_id, cart_items) {
  const sku_ids = cart_items.filter(i => i.sku_id).map(i => i.sku_id);
  if (!sku_ids.length) return { ok: true, needs_backorder: false, issues: [] };

  const [stocks, rules] = await Promise.all([
    repo.getStockLevels(node_id, sku_ids),
    repo.getSellingRules(node_id, sku_ids),
  ]);

  const stockMap = Object.fromEntries(stocks.map(s => [s.sku_id, s]));
  const ruleMap  = Object.fromEntries(rules.map(r => [r.sku_id, r]));
  const issues = [];
  let needs_backorder = false;

  for (const item of cart_items) {
    if (!item.sku_id) continue;
    const qty     = Number(item.qty || 1);
    const stock   = stockMap[item.sku_id];
    const rule    = ruleMap[item.sku_id];
    const avail   = stock ? Number(stock.qty_available) : 0;

    if (avail >= qty) continue;

    const shortage = qty - avail;
    if (rule?.is_backorderable && Number(rule.backorder_limit) >= shortage) {
      needs_backorder = true;
      continue; // backorder allowed
    }

    issues.push({
      sku_id:        item.sku_id,
      qty_requested: qty,
      qty_available: avail,
      reason:        rule?.is_backorderable ? 'backorder_limit_exceeded' : 'insufficient_stock',
    });
  }

  return { ok: issues.length === 0, needs_backorder, issues };
}

// ── Node daily capacity check ─────────────────────────────────────────────────
async function checkNodeCapacity(node, date) {
  if (!node.max_daily_orders) return { ok: true };
  const count = await repo.countOrdersForNodeDay(node.id, date);
  return { ok: count < node.max_daily_orders, current: count, max: node.max_daily_orders };
}

// ── Augment slots with real-time capacity ─────────────────────────────────────
async function enrichSlots(slots, date) {
  return Promise.all(
    slots.map(async (s) => {
      const count = await repo.countOrdersForSlotDay(s.id, date);
      const available = s.max_orders ? s.max_orders - count : null;
      return { ...s, orders_count: count, available_capacity: available, is_full: s.max_orders ? count >= s.max_orders : false };
    })
  );
}

// ── findEligibleNodes ─────────────────────────────────────────────────────────
async function findEligibleNodes(address_id, cart_items, date) {
  const address = await repo.getAddress(address_id);
  if (!address) throw { statusCode: 404, message: 'Adresse introuvable' };

  const checkDate  = date instanceof Date ? date : targetDate(date);
  const dayOfWeek  = checkDate.getDay();
  const nodes      = await repo.getActiveNodesInCity(address.city);

  const eligible   = [];
  const ineligible = [];

  for (const node of nodes) {
    const reasons = [];

    // 1. Distance
    let distance_km = null;
    if (address.lat && address.lng && node.lat && node.lng) {
      distance_km = parseFloat(
        repo.haversineKm(address.lat, address.lng, node.lat, node.lng).toFixed(2)
      );
      if (node.delivery_radius_km && distance_km > Number(node.delivery_radius_km)) {
        reasons.push({ code: 'out_of_radius', distance_km, radius_km: node.delivery_radius_km });
      }
    }

    // 2. Active slots for the day
    const daySlots = node.delivery_slots.filter(s => s.day_of_week === dayOfWeek);
    if (!daySlots.length) reasons.push({ code: 'no_slots_for_day', day_of_week: dayOfWeek });

    // 3. Daily capacity
    const cap = await checkNodeCapacity(node, checkDate);
    if (!cap.ok) reasons.push({ code: 'daily_capacity_reached', current: cap.current, max: cap.max });

    // 4. Stock
    const stock = await checkStock(node.id, cart_items);
    if (!stock.ok) reasons.push({ code: 'insufficient_stock', issues: stock.issues });

    if (reasons.length === 0) {
      eligible.push({ ...node, distance_km, day_slots: daySlots, needs_backorder: stock.needs_backorder });
    } else {
      ineligible.push({ node_id: node.id, name_fr: node.name_fr, city: node.city, reasons });
    }
  }

  // Sort: closest first (null distance = last)
  eligible.sort((a, b) => {
    if (a.distance_km === null) return 1;
    if (b.distance_km === null) return -1;
    return a.distance_km - b.distance_km;
  });

  return { address, eligible, ineligible, best_node: eligible[0] ?? null, date: checkDate.toISOString().split('T')[0] };
}

// ── getDeliverySlots ──────────────────────────────────────────────────────────
async function getDeliverySlots(address_id, delivery_type_id, cart_items, date) {
  const deliveryType = await repo.getDeliveryType(delivery_type_id);
  if (!deliveryType) throw { statusCode: 404, message: 'Type de livraison introuvable' };

  const checkDate = targetDate(date);
  const dayOfWeek = checkDate.getDay();

  // HOME
  if (deliveryType.code === 'home') {
    if (!address_id) throw { statusCode: 400, message: 'Adresse requise pour livraison à domicile' };
    const result = await findEligibleNodes(address_id, cart_items || [], checkDate);

    if (!result.best_node) {
      return {
        delivery_type: deliveryType,
        node: null,
        slots: [],
        eligible_count: 0,
        message: result.ineligible.length
          ? 'Aucun node éligible pour cette adresse et ce panier'
          : 'Aucun node disponible dans cette ville',
        date: checkDate.toISOString().split('T')[0],
      };
    }

    const node   = result.best_node;
    const slots  = await enrichSlots(node.day_slots, checkDate);
    const avail  = slots.filter(s => !s.is_full);

    return {
      delivery_type: deliveryType,
      node:  { id: node.id, name_fr: node.name_fr, name_ar: node.name_ar, distance_km: node.distance_km, city: node.city },
      slots: avail,
      all_slots: slots,
      eligible_count: result.eligible.length,
      date: checkDate.toISOString().split('T')[0],
    };
  }

  // PICKUP
  if (deliveryType.code === 'pickup') {
    const nodes = await repo.getAllActiveNodes();
    const pickupNodes = await Promise.all(
      nodes.map(async (n) => {
        const daySlots = n.delivery_slots.filter(s => s.day_of_week === dayOfWeek);
        const enriched = await enrichSlots(daySlots, checkDate);
        return { id: n.id, name_fr: n.name_fr, name_ar: n.name_ar, city: n.city, slots: enriched };
      })
    );
    return { delivery_type: deliveryType, pickup_nodes: pickupNodes, date: checkDate.toISOString().split('T')[0] };
  }

  throw { statusCode: 400, message: `Type de livraison «${deliveryType.code}» non supporté pour cette API` };
}

// ── createOrder ───────────────────────────────────────────────────────────────
async function createOrder(payload) {
  const {
    customer_id, address_id, delivery_type_id,
    node_id,              // required for pickup; auto-determined for home
    selected_slot_id,
    payment_method_id,
    cart_items,
    notes,
    date,
  } = payload;

  if (!cart_items?.length) throw { statusCode: 400, message: 'Panier vide' };
  if (!customer_id)        throw { statusCode: 400, message: 'customer_id requis' };

  // Verify customer
  const customer = await repo.getCustomer(customer_id);
  if (!customer) throw { statusCode: 404, message: 'Client introuvable' };
  if (!customer.is_active) throw { statusCode: 403, message: 'Compte client bloqué' };

  const deliveryType = await repo.getDeliveryType(delivery_type_id);
  if (!deliveryType) throw { statusCode: 404, message: 'Type de livraison introuvable' };

  const checkDate = targetDate(date);

  // Determine node
  let finalNodeId = node_id;
  let needsBackorder = false;

  if (deliveryType.code === 'home') {
    if (!address_id) throw { statusCode: 400, message: 'Adresse requise pour livraison à domicile' };
    const result = await findEligibleNodes(address_id, cart_items, checkDate);
    if (!result.best_node) throw { statusCode: 422, message: 'Aucun node éligible pour cette adresse et ce panier' };
    finalNodeId   = result.best_node.id;
    needsBackorder = result.best_node.needs_backorder;
  } else {
    if (!finalNodeId) throw { statusCode: 400, message: 'node_id requis pour retrait magasin' };
    const stockCheck = await checkStock(finalNodeId, cart_items);
    if (!stockCheck.ok) throw { statusCode: 422, message: 'Stock insuffisant sur ce node', issues: stockCheck.issues };
    needsBackorder = stockCheck.needs_backorder;
  }

  // Get lookup IDs
  const [pendingOrder, activeItem, pendingPayment] = await Promise.all([
    repo.getOrderStatusByCode('pending'),
    repo.getOrderItemStatusByCode('active'),
    repo.getPaymentStatusByCode('pending'),
  ]);
  const awaitStockOrder = needsBackorder ? await repo.getOrderStatusByCode('awaiting_stock') : null;
  const orderStatusId = (needsBackorder && awaitStockOrder) ? awaitStockOrder.id : pendingOrder?.id;

  if (!orderStatusId) throw { statusCode: 500, message: 'Statut commande "pending" non trouvé — lancez le seed' };
  if (!activeItem)    throw { statusCode: 500, message: 'Statut ligne "active" non trouvé — lancez le seed' };

  // Compute totals
  let subtotal_ht = 0;
  let vat_amount  = 0;
  const itemsData = cart_items.map(item => {
    const qty       = Number(item.qty || 1);
    const unitPrice = Number(item.unit_price || 0);
    const vatRate   = Number(item.vat_rate ?? 20);
    const lineHT    = unitPrice / (1 + vatRate / 100);
    const lineVAT   = unitPrice * qty - lineHT * qty;
    subtotal_ht    += lineHT * qty;
    vat_amount     += lineVAT;
    return {
      sku_id:          item.sku_id  || null,
      pack_id:         item.pack_id || null,
      status_id:       activeItem.id,
      qty,
      unit_price_sold: unitPrice,
      discount_amount: Number(item.discount_amount || 0),
      vat_rate:        vatRate,
      node_id:         finalNodeId,
    };
  });
  const total_ttc = subtotal_ht + vat_amount;

  // Transaction: create order → items → stock reservation → payment
  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        customer_id,
        node_id:           finalNodeId,
        address_id:        address_id || null,
        status_id:         orderStatusId,
        delivery_type_id,
        confirmed_slot_id: selected_slot_id || null,
        subtotal_ht:       parseFloat(subtotal_ht.toFixed(2)),
        vat_amount:        parseFloat(vat_amount.toFixed(2)),
        total_ttc:         parseFloat(total_ttc.toFixed(2)),
        notes:             notes || null,
        items:             { create: itemsData },
      },
      include: { items: true, status: true, delivery_type: true, node: { select: { id: true, name_fr: true, code: true } } },
    });

    // Reserve stock
    for (const item of cart_items) {
      if (!item.sku_id) continue;
      const qty = Number(item.qty || 1);
      await tx.stockLevel.updateMany({
        where: { node_id: finalNodeId, sku_id: item.sku_id },
        data: { qty_reserved: { increment: qty }, qty_available: { decrement: qty } },
      });
    }

    // Payment record
    if (payment_method_id && pendingPayment) {
      await tx.payment.create({
        data: {
          order_id:          newOrder.id,
          status_id:         pendingPayment.id,
          payment_method_id: payment_method_id,
          amount:            parseFloat(total_ttc.toFixed(2)),
          currency:          'MAD',
        },
      });
    }

    return newOrder;
  });

  return order;
}

module.exports = { findEligibleNodes, getDeliverySlots, createOrder, checkStock };
