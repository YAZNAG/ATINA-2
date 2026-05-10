const prisma = require('../../config/database');
const repo   = require('./checkout.repository');

// ── City normalizer (accents + case + spaces) ─────────────────────────────────
function normalizeCity(s) {
  if (!s) return '';
  return s.trim().toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/\s+/g, ' ');
}

// ── Date helper ───────────────────────────────────────────────────────────────
function targetDate(input) {
  if (input) return new Date(input);
  const now = new Date();
  if (now.getHours() >= 14) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }
  return now;
}

// ── Stock check ───────────────────────────────────────────────────────────────
// Lenient for back-office: missing stock_levels record = UNKNOWN (not a hard block)
// Only hard-block if record EXISTS AND qty_available < qty AND no backorder allowed
async function checkStock(node_id, cart_items, { strict = false } = {}) {
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
    const qty   = Number(item.qty || 1);
    const stock = stockMap[item.sku_id];
    const rule  = ruleMap[item.sku_id];

    // No stock record found → lenient: treat as available (back-office context)
    if (!stock) {
      if (strict) issues.push({ sku_id: item.sku_id, reason: 'no_stock_level_record' });
      // non-strict: silently assume OK
      continue;
    }

    const avail = Number(stock.qty_available);
    if (avail >= qty) continue; // enough stock

    const shortage = qty - avail;

    // Check backorder
    if (rule?.is_backorderable && Number(rule.backorder_limit || 0) >= shortage) {
      needs_backorder = true;
      continue;
    }

    // Also allow if is_backorderable but no explicit limit set
    if (rule?.is_backorderable && !rule.backorder_limit) {
      needs_backorder = true;
      continue;
    }

    issues.push({
      sku_id: item.sku_id, qty_requested: qty, qty_available: avail,
      reason: rule?.is_backorderable ? 'backorder_limit_exceeded' : 'insufficient_stock',
    });
  }

  return { ok: issues.length === 0, needs_backorder, issues };
}

// ── Node capacity ─────────────────────────────────────────────────────────────
async function checkNodeCapacity(node, date) {
  if (!node.max_daily_orders) return { ok: true };
  const count = await repo.countOrdersForNodeDay(node.id, date);
  return { ok: count < node.max_daily_orders, current: count, max: node.max_daily_orders };
}

// ── Enrich slots with live capacity ──────────────────────────────────────────
async function enrichSlots(slots, date) {
  return Promise.all(slots.map(async (s) => {
    const count = await repo.countOrdersForSlotDay(s.id, date);
    const available = s.max_orders ? s.max_orders - count : null;
    return { ...s, orders_count: count, available_capacity: available, is_full: s.max_orders ? count >= s.max_orders : false };
  }));
}

// ── findEligibleNodes — THE single source of truth ────────────────────────────
async function findEligibleNodes(address_id, cart_items, date, { debug = false } = {}) {
  const address = await repo.getAddress(address_id);
  if (!address) throw { statusCode: 404, message: 'Adresse introuvable' };

  const checkDate = date instanceof Date ? date : targetDate(date);
  const dayOfWeek = checkDate.getDay();
  const cityNorm  = normalizeCity(address.city);

  if (debug) console.log(`\n[CHECKOUT DEBUG] findEligibleNodes`);
  if (debug) console.log(`  address: ${address.street_name}, ${address.city} (norm: "${cityNorm}")`);
  if (debug) console.log(`  date: ${checkDate.toISOString()} — dayOfWeek: ${dayOfWeek}`);
  if (debug) console.log(`  cart_items: ${cart_items.length}`);

  // Load ALL active nodes — filter by normalized city in JS
  const allNodes = await repo.getAllActiveNodes();
  const cityNodes = allNodes.filter(n => {
    const nodeCityNorm = normalizeCity(n.city?.name_fr);
    return nodeCityNorm === cityNorm;
  });

  if (debug) console.log(`  nodes in city "${cityNorm}": ${cityNodes.length} / total active: ${allNodes.length}`);

  const eligible   = [];
  const ineligible = [];

  for (const node of cityNodes) {
    const reasons = [];
    if (debug) console.log(`\n  — Node: ${node.name_fr} (${node.code})`);

    // 1. Distance check (only if both lat/lng present)
    let distance_km = null;
    if (address.lat && address.lng && node.lat && node.lng) {
      distance_km = parseFloat(repo.haversineKm(address.lat, address.lng, node.lat, node.lng).toFixed(2));
      const radius = node.delivery_radius_km ? Number(node.delivery_radius_km) : null;
      if (debug) console.log(`    distance: ${distance_km} km / radius: ${radius ?? 'none'}`);
      if (radius && distance_km > radius) {
        reasons.push({ code: 'out_of_radius', distance_km, radius_km: radius });
        if (debug) console.log(`    → OUT_OF_RADIUS`);
      }
    } else {
      if (debug) console.log(`    distance: N/A (no GPS) — fallback to city only`);
    }

    // 2. Active slots for this day
    const daySlots = node.delivery_slots.filter(s => s.day_of_week === dayOfWeek);
    if (debug) console.log(`    slots for day ${dayOfWeek}: ${daySlots.length}`);
    if (!daySlots.length) {
      reasons.push({ code: 'no_slots_for_day', day_of_week: dayOfWeek });
      if (debug) console.log(`    → NO_SLOTS_FOR_DAY`);
    }

    // 3. Daily capacity
    const cap = await checkNodeCapacity(node, checkDate);
    if (debug) console.log(`    daily capacity: ${cap.current ?? 0}/${cap.max ?? '∞'} — ok: ${cap.ok}`);
    if (!cap.ok) {
      reasons.push({ code: 'daily_capacity_reached', current: cap.current, max: cap.max });
      if (debug) console.log(`    → CAPACITY_REACHED`);
    }

    // 4. Stock check (lenient — missing record = OK)
    const stock = await checkStock(node.id, cart_items, { strict: false });
    if (debug) console.log(`    stock ok: ${stock.ok} (issues: ${stock.issues.length})`);
    if (!stock.ok) {
      reasons.push({ code: 'insufficient_stock', issues: stock.issues });
      if (debug) console.log(`    → INSUFFICIENT_STOCK`, stock.issues.map(i => i.sku_id).join(', '));
    }

    if (reasons.length === 0) {
      eligible.push({ ...node, distance_km, day_slots: daySlots, needs_backorder: stock.needs_backorder });
      if (debug) console.log(`    → ELIGIBLE ✓`);
    } else {
      ineligible.push({ node_id: node.id, name_fr: node.name_fr, city: node.city, reasons });
    }
  }

  // Sort by distance (closest first; null = last)
  eligible.sort((a, b) => {
    if (a.distance_km === null) return 1;
    if (b.distance_km === null) return -1;
    return a.distance_km - b.distance_km;
  });

  if (debug) {
    console.log(`\n  RESULT: eligible=${eligible.length}, ineligible=${ineligible.length}`);
    if (eligible[0]) console.log(`  BEST NODE: ${eligible[0].name_fr}`);
  }

  return { address, eligible, ineligible, best_node: eligible[0] ?? null, date: checkDate.toISOString().split('T')[0] };
}

// ── getDeliverySlots ──────────────────────────────────────────────────────────
async function getDeliverySlots(address_id, delivery_type_id, cart_items, date) {
  const deliveryType = await repo.getDeliveryType(delivery_type_id);
  if (!deliveryType) throw { statusCode: 404, message: 'Type de livraison introuvable' };

  const checkDate = targetDate(date);
  const dayOfWeek = checkDate.getDay();

  if (deliveryType.code === 'home') {
    if (!address_id) throw { statusCode: 400, message: 'Adresse requise pour livraison à domicile' };
    const result = await findEligibleNodes(address_id, cart_items || [], checkDate, { debug: false });

    if (!result.best_node) {
      return {
        delivery_type: deliveryType, node: null, slots: [], eligible_count: 0,
        message: result.eligible.length === 0
          ? (result.ineligible.length ? 'Aucun node éligible pour cette adresse' : 'Aucun node disponible dans cette ville')
          : 'Pas de créneaux disponibles',
        debug: { ineligible: result.ineligible },
        date: checkDate.toISOString().split('T')[0],
      };
    }

    const node  = result.best_node;
    const slots = await enrichSlots(node.day_slots, checkDate);
    const avail = slots.filter(s => !s.is_full);

    return {
      delivery_type: deliveryType,
      node: { id: node.id, name_fr: node.name_fr, name_ar: node.name_ar, distance_km: node.distance_km, city: node.city },
      slots: avail, all_slots: slots,
      eligible_count: result.eligible.length,
      date: checkDate.toISOString().split('T')[0],
    };
  }

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

  throw { statusCode: 400, message: `Type de livraison «${deliveryType.code}» non supporté` };
}

// ── createOrder ───────────────────────────────────────────────────────────────
async function createOrder(payload) {
  const { customer_id, address_id, delivery_type_id, node_id, selected_slot_id, payment_method_id, cart_items, notes, date } = payload;

  console.log('\n[CHECKOUT] createOrder payload:', JSON.stringify({
    customer_id, address_id, delivery_type_id, node_id,
    selected_slot_id, payment_method_id,
    cart_items_count: cart_items?.length,
    cart_items,
  }, null, 2));

  // ── Basic validation ────────────────────────────────────────────────────────
  if (!customer_id)        throw { statusCode: 400, message: 'customer_id requis' };
  if (!delivery_type_id)   throw { statusCode: 400, message: 'delivery_type_id requis' };
  if (!cart_items?.length) throw { statusCode: 400, message: 'Panier vide — cart_items requis' };

  for (const [i, item] of cart_items.entries()) {
    if (!item.sku_id && !item.pack_id) throw { statusCode: 400, message: `cart_items[${i}]: sku_id ou pack_id requis` };
    if (!Number(item.qty) || Number(item.qty) <= 0) throw { statusCode: 400, message: `cart_items[${i}]: qty doit être > 0` };
  }

  // ── Verify customer ─────────────────────────────────────────────────────────
  const customer = await repo.getCustomer(customer_id);
  if (!customer)          throw { statusCode: 404, message: 'Client introuvable' };
  if (!customer.is_active) throw { statusCode: 403, message: 'Compte client bloqué' };

  // ── Delivery type ───────────────────────────────────────────────────────────
  const deliveryType = await repo.getDeliveryType(delivery_type_id);
  if (!deliveryType) throw { statusCode: 404, message: 'Type de livraison introuvable' };

  const checkDate = targetDate(date);

  // ── Determine node ──────────────────────────────────────────────────────────
  let finalNodeId    = node_id || null;
  let needsBackorder = false;

  if (deliveryType.code === 'home') {
    if (!address_id) throw { statusCode: 400, message: 'address_id requis pour livraison à domicile' };

    if (finalNodeId) {
      // Frontend already determined node via /delivery-slots → trust it
      console.log(`[CHECKOUT] home delivery — using provided node_id: ${finalNodeId}`);
      // Light stock check (lenient)
      const stockCheck = await checkStock(finalNodeId, cart_items, { strict: false });
      needsBackorder = stockCheck.needs_backorder;
    } else {
      // Auto-determine node (fallback)
      console.log('[CHECKOUT] home delivery — no node_id provided, running eligibility...');
      const result = await findEligibleNodes(address_id, cart_items, checkDate, { debug: true });
      if (!result.best_node) {
        const details = result.ineligible.map(n => `${n.name_fr}: ${n.reasons.map(r => r.code).join(', ')}`).join(' | ');
        throw { statusCode: 422, message: 'Aucun node éligible pour cette adresse et ce panier', debug: details };
      }
      finalNodeId    = result.best_node.id;
      needsBackorder = result.best_node.needs_backorder;
      console.log(`[CHECKOUT] auto-selected node: ${result.best_node.name_fr} (${finalNodeId})`);
    }
  } else {
    // PICKUP
    if (!finalNodeId) throw { statusCode: 400, message: 'node_id requis pour retrait magasin' };
    const stockCheck = await checkStock(finalNodeId, cart_items, { strict: false });
    needsBackorder = stockCheck.needs_backorder;
    console.log(`[CHECKOUT] pickup node: ${finalNodeId}`);
  }

  // ── Lookup statuses ─────────────────────────────────────────────────────────
  const [pendingOrder, activeItem, pendingPayment] = await Promise.all([
    repo.getOrderStatusByCode('pending'),
    repo.getOrderItemStatusByCode('active'),
    repo.getPaymentStatusByCode('pending'),
  ]);
  const awaitStock   = needsBackorder ? await repo.getOrderStatusByCode('awaiting_stock') : null;
  const orderStatus  = (needsBackorder && awaitStock) ? awaitStock : pendingOrder;

  if (!orderStatus) throw { statusCode: 500, message: 'Statut "pending" introuvable — lancez: node scripts/seedAuthSystem.js' };
  if (!activeItem)  throw { statusCode: 500, message: 'Statut ligne "active" introuvable — lancez: node scripts/seedAuthSystem.js' };

  console.log(`[CHECKOUT] status: ${orderStatus.code}, node: ${finalNodeId}`);

  // ── Compute totals ──────────────────────────────────────────────────────────
  let subtotal_ht = 0;
  let vat_amount  = 0;

  const itemsData = cart_items.map(item => {
    const qty       = Number(item.qty || 1);
    const unitPrice = Number(item.unit_price || 0);
    const vatRate   = Number(item.vat_rate ?? 20);
    const lineHT    = unitPrice / (1 + vatRate / 100);
    subtotal_ht    += lineHT * qty;
    vat_amount     += (unitPrice - lineHT) * qty;
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

  const total_ttc = parseFloat((subtotal_ht + vat_amount).toFixed(2));

  // ── Transaction ─────────────────────────────────────────────────────────────
  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        customer_id,
        node_id:           finalNodeId,
        address_id:        address_id || null,
        status_id:         orderStatus.id,
        delivery_type_id,
        confirmed_slot_id: selected_slot_id || null,
        subtotal_ht:       parseFloat(subtotal_ht.toFixed(2)),
        vat_amount:        parseFloat(vat_amount.toFixed(2)),
        total_ttc,
        notes:             notes || null,
        items:             { create: itemsData },
      },
      include: { items: true, status: true, delivery_type: true, node: { select: { id: true, name_fr: true, code: true } } },
    });

    // Reserve stock only where stock_level records exist
    for (const item of cart_items) {
      if (!item.sku_id) continue;
      const qty = Number(item.qty || 1);
      await tx.stockLevel.updateMany({
        where: { node_id: finalNodeId, sku_id: item.sku_id },
        data:  { qty_reserved: { increment: qty }, qty_available: { decrement: qty } },
      });
    }

    // Payment
    if (payment_method_id && pendingPayment) {
      await tx.payment.create({
        data: {
          order_id:          newOrder.id,
          status_id:         pendingPayment.id,
          payment_method_id,
          amount:            total_ttc,
          currency:          'MAD',
        },
      });
    }

    return newOrder;
  });

  console.log(`[CHECKOUT] order created: ${order.id} — total: ${total_ttc} MAD`);
  return order;
}

module.exports = { findEligibleNodes, getDeliverySlots, createOrder, checkStock };
