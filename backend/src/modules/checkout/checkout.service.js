const prisma = require('../../config/database');
const repo   = require('./checkout.repository');
const { resolveItemPrice } = require('./pricing.shared');

// ── Groupes de codes équivalents ──────────────────────────────────────────────
const HOME_LIKE_CODES   = ['HOME_DELIVERY', 'SCHEDULED'];
const PICKUP_LIKE_CODES = ['PICKUP', 'IN_STORE'];

// ── City normalizer ───────────────────────────────────────────────────────────
function normalizeCity(s) {
  if (!s) return '';
  return s.trim().toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

// ── Date helper — if after 14h, target tomorrow ───────────────────────────────
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

// ── opening_hours_json parser ─────────────────────────────────────────────────
const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function isDayOpen(openingHoursJson, dayOfWeek) {
  if (!openingHoursJson || typeof openingHoursJson !== 'object') return true;
  if (Object.keys(openingHoursJson).length === 0) return true;

  const byName   = openingHoursJson[DOW_KEYS[dayOfWeek]];
  const byNumber = openingHoursJson[String(dayOfWeek)];
  const entry    = byName !== undefined ? byName : byNumber;

  if (entry === undefined) return false;
  if (entry === null || entry === false) return false;
  if (Array.isArray(entry)) return entry.length >= 2;
  if (typeof entry === 'object') return !!(entry.open);
  return false;
}

// ── Is slot still valid for today? ───────────────────────────────────────────
function isSlotStillValid(slot, checkDate) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const check = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
  if (check > today) return true;

  const slotEnd = slot.slot_end;
  if (!slotEnd) return true;
  const parts = slotEnd.toString().split(':').map(Number);
  const slotEndTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parts[0], parts[1] ?? 0);
  return now < slotEndTime;
}

// ── Stock check ───────────────────────────────────────────────────────────────
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

    if (!stock) {
      if (strict) issues.push({ sku_id: item.sku_id, reason: 'no_stock_level_record' });
      continue;
    }

    const avail = Number(stock.qty_available);
    if (avail >= qty) continue;

    const shortage = qty - avail;
    if (rule?.is_backorderable && (!rule.backorder_limit || Number(rule.backorder_limit) >= shortage)) {
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

// ── Enrich slots with live capacity + time filtering ─────────────────────────
async function enrichSlots(slots, checkDate) {
  return Promise.all(slots.map(async (s) => {
    const count     = await repo.countOrdersForSlotDay(s.id, checkDate);
    const available = s.max_orders ? s.max_orders - count : null;
    const is_full   = s.max_orders ? count >= s.max_orders : false;
    const is_past   = !isSlotStillValid(s, checkDate);
    return { ...s, orders_count: count, available_capacity: available, is_full, is_past };
  }));
}

// ── META (filtré par node config) ────────────────────────────────────────────
async function getMeta(node_id = null) {
  const [allDeliveryTypes, allPaymentMethods, orderStatuses, paymentStatuses, appConfigs, nodeData] = await Promise.all([
    repo.getAllDeliveryTypes(),
    repo.getAllPaymentMethods(),
    repo.getAllOrderStatuses(),
    repo.getAllPaymentStatuses(),
    repo.getAppConfigs(node_id),
    node_id ? repo.getNodeById(node_id) : Promise.resolve(null),
  ]);

  const homeEnabled   = appConfigs['home_delivery_enabled']   !== 'false';
  const pickupEnabled = appConfigs['pickup_enabled']          !== 'false';

  const delivery_types = allDeliveryTypes.filter(dt => {
    if (dt.code === 'home')   return homeEnabled;
    if (dt.code === 'pickup') return pickupEnabled;
    return true;
  });

  const codMaxAmount = parseFloat(appConfigs['cod_max_amount'] ?? 0);

  const payment_methods = allPaymentMethods.filter(pm => {
    if (!pm.is_active) return false;
    if (pm.code === 'cod')    return appConfigs['cod_enabled']    !== 'false';
    if (pm.code === 'wallet') return appConfigs['wallet_enabled'] !== 'false';
    if (pm.code === 'card')   return appConfigs['card_enabled']   !== 'false';
    if (pm.code === 'mixed')  return appConfigs['mixed_enabled']  !== 'false';
    return true;
  }).map(pm => ({
    ...pm,
    cod_max_amount: pm.code === 'cod' && codMaxAmount > 0 ? codMaxAmount : null,
  }));

  return {
    delivery_types,
    payment_methods,
    order_statuses:   orderStatuses,
    payment_statuses: paymentStatuses,
    app_configs:      appConfigs,
    node: nodeData ? {
      id:                 nodeData.id,
      name_fr:            nodeData.name_fr,
      opening_hours_json: nodeData.opening_hours_json ?? {},
      max_daily_orders:   nodeData.max_daily_orders,
    } : null,
  };
}

// ── AVAILABLE DATES — dates ouvertes avec créneaux restants ──────────────────
async function getAvailableDates(node_id, delivery_type_code, days_ahead = 14) {
  if (!node_id) throw { statusCode: 400, message: 'node_id requis' };

  const nodeRows = await repo.getAllActiveNodes();
  const node = nodeRows.find(n => n.id === node_id);
  if (!node) throw { statusCode: 404, message: 'Node introuvable ou inactif' };

  const opening = node.opening_hours_json ?? {};
  const today   = new Date();
  const start   = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end     = new Date(start);
  end.setDate(end.getDate() + days_ahead - 1);

  // Un seul fetch pour toute la plage plutôt qu'une requête par jour
  const slots = await repo.getSlotsForNodeInRange(node_id, start, end);
  const slotsByDate = {};
  for (const s of slots) {
    const key = s.specific_date.toISOString().slice(0, 10);
    if (!slotsByDate[key]) slotsByDate[key] = [];
    slotsByDate[key].push(s);
  }

  const results = [];

  for (let i = 0; i < days_ahead; i++) {
    const d   = new Date(start);
    d.setDate(start.getDate() + i);
    const dow     = d.getDay();
    const dateStr = d.toISOString().split('T')[0];

    if (!isDayOpen(opening, dow)) {
      results.push({ date: dateStr, available: false, reason: 'closed' });
      continue;
    }

    const daySlots = slotsByDate[dateStr] || [];
    if (!daySlots.length) {
      results.push({ date: dateStr, available: false, reason: 'no_slots' });
      continue;
    }

    const cap = await checkNodeCapacity(node, d);
    if (!cap.ok) {
      results.push({ date: dateStr, available: false, reason: 'capacity_reached', current: cap.current, max: cap.max });
      continue;
    }

    const enriched = await enrichSlots(daySlots, d);
    const hasOpen  = enriched.some(s => !s.is_full && !s.is_past);
    if (!hasOpen) {
      results.push({ date: dateStr, available: false, reason: 'all_slots_full_or_past' });
      continue;
    }

    results.push({ date: dateStr, available: true, slots_count: daySlots.length });
  }

  return results;
}

// ── CALCULATE — server-side cart total ───────────────────────────────────────
async function calculate({ node_id, delivery_type_code, cart_items, payment_method_code, wallet_used = 0, customer_id, promo_code = null }) {
  if (!cart_items?.length) throw { statusCode: 400, message: 'Panier vide' };
  if (!node_id)            throw { statusCode: 400, message: 'node_id requis' };

  const configs = await repo.getAppConfigs(node_id);
  const deliveryFeeConfig        = parseFloat(configs['delivery_fee'] ?? configs['delivery_fee_home'] ?? 0);
  const freeDeliveryThreshold    = parseFloat(configs['free_delivery_threshold'] ?? 0);
  const minOrderAmount           = parseFloat(configs['min_order_amount'] ?? 0);

  let subtotal_ht  = 0;
  let vat_amount   = 0;
  const enrichedItems = [];

  for (const item of cart_items) {
    const qty    = Number(item.qty || 1);
    const priced = await resolveItemPrice(node_id, item);

    const lineHT = priced.unit_price / (1 + priced.vat_rate / 100);
    subtotal_ht += lineHT * qty;
    vat_amount  += (priced.unit_price - lineHT) * qty;

    enrichedItems.push({
      sku_id:         item.sku_id  || null,
      pack_id:        item.pack_id || null,
      name_fr:        priced.name_fr,
      qty,
      unit_price_ttc: priced.unit_price,
      vat_rate:       priced.vat_rate,
      line_total:     parseFloat((priced.unit_price * qty).toFixed(2)),
      price_source:   priced.source,
    });
  }

  subtotal_ht = parseFloat(subtotal_ht.toFixed(2));
  vat_amount  = parseFloat(vat_amount.toFixed(2));
  const subtotal_ttc = parseFloat((subtotal_ht + vat_amount).toFixed(2));

  if (minOrderAmount > 0 && subtotal_ttc < minOrderAmount)
    throw { statusCode: 422, message: `Montant minimum de commande : ${minOrderAmount} MAD (panier actuel : ${subtotal_ttc} MAD)` };

  let delivery_fee = 0;
  if (!PICKUP_LIKE_CODES.includes(delivery_type_code)) {
    delivery_fee = (freeDeliveryThreshold > 0 && subtotal_ttc >= freeDeliveryThreshold)
      ? 0
      : deliveryFeeConfig;
  }

  let discount_amount = 0;
  let coupon_error    = null;
  if (promo_code) {
    try {
      const { validateCoupon, computeCouponDiscount } = require('../coupons/coupons.shared');
      const promo = await validateCoupon(promo_code.toUpperCase().trim(), customer_id, subtotal_ttc);
      const res = computeCouponDiscount(promo, subtotal_ttc, delivery_fee);
      discount_amount = res.free_shipping ? parseFloat(delivery_fee.toFixed(2)) : res.discount;
    } catch (e) {
      coupon_error = e.message || 'Code promo invalide';
    }
  }
  discount_amount = parseFloat(Math.min(discount_amount, subtotal_ttc).toFixed(2));

  let wallet_deduction = 0;
  if (wallet_used > 0 && customer_id) {
    const customer = await repo.getCustomer(customer_id);
    const maxWallet = Math.min(Number(customer?.wallet_balance ?? 0), wallet_used);
    wallet_deduction = parseFloat(Math.max(0, maxWallet).toFixed(2));
  }

  const total_ttc = parseFloat(Math.max(0, subtotal_ttc + delivery_fee - discount_amount - wallet_deduction).toFixed(2));
  const normalizedPaymentCode = String(payment_method_code || '').trim().toLowerCase();
  const cod_amount = ['cod', 'cash'].includes(normalizedPaymentCode) ? total_ttc : 0;

  return {
    items:          enrichedItems,
    subtotal_ht,
    vat_amount,
    subtotal_ttc,
    delivery_fee:   parseFloat(delivery_fee.toFixed(2)),
    discount_amount,
    coupon_error,
    wallet_used:    wallet_deduction,
    total_ttc,
    cod_amount,
    currency:       'MAD',
  };
}

// ── FIND ELIGIBLE NODES (home delivery) ──────────────────────────────────────
async function findEligibleNodes(address_id, cart_items, date) {
  const address = await repo.getAddress(address_id);
  if (!address) throw { statusCode: 404, message: 'Adresse introuvable' };

  const checkDate = date instanceof Date ? date : targetDate(date);
  const cityNorm  = normalizeCity(address.city);

  const allNodes  = await repo.getAllActiveNodes();
  const cityNodes = allNodes.filter(n => normalizeCity(n.city?.name_fr) === cityNorm);

  const eligible   = [];
  const ineligible = [];

  for (const node of cityNodes) {
    const reasons = [];

    let distance_km = null;
    if (address.lat && address.lng && node.lat && node.lng) {
      distance_km = parseFloat(repo.haversineKm(address.lat, address.lng, node.lat, node.lng).toFixed(2));
      const radius = node.delivery_radius_km ? Number(node.delivery_radius_km) : null;
      if (radius && distance_km > radius)
        reasons.push({ code: 'out_of_radius', distance_km, radius_km: radius });
    }

    const daySlots = await repo.getSlotsForNodeAndDate(node.id, checkDate);
    if (!daySlots.length)
      reasons.push({ code: 'no_slots_for_date', date: checkDate.toISOString().split('T')[0] });

    const cap = await checkNodeCapacity(node, checkDate);
    if (!cap.ok)
      reasons.push({ code: 'daily_capacity_reached', current: cap.current, max: cap.max });

    const stock = await checkStock(node.id, cart_items, { strict: false });
    if (reasons.length === 0)
      eligible.push({ ...node, day_slots: daySlots, needs_backorder: stock.needs_backorder });
    else
      ineligible.push({ node_id: node.id, name_fr: node.name_fr, city: node.city, reasons });
  }

  eligible.sort((a, b) => {
    if (a.distance_km === null) return 1;
    if (b.distance_km === null) return -1;
    return a.distance_km - b.distance_km;
  });

  return { address, eligible, ineligible, best_node: eligible[0] ?? null, date: checkDate.toISOString().split('T')[0] };
}

// ── FIND ELIGIBLE NODES FOR PICKUP ───────────────────────────────────────────
async function findPickupNodes(cart_items, date) {
  const checkDate = date instanceof Date ? date : targetDate(date);
  const allNodes  = await repo.getAllActiveNodes();

  const eligible = await Promise.all(allNodes.map(async (node) => {
    const daySlots = await repo.getSlotsForNodeAndDate(node.id, checkDate);
    const stock    = await checkStock(node.id, cart_items, { strict: false });
    return { ...node, day_slots: daySlots, needs_backorder: stock.needs_backorder };
  }));

  return {
    eligible,
    ineligible: [],
    auto_selected: eligible.length === 1 ? eligible[0] : null,
    date: checkDate.toISOString().split('T')[0],
  };
}

// ── DELIVERY SLOTS ────────────────────────────────────────────────────────────
async function getDeliverySlots(params) {
  const { address_id, node_id, delivery_type_id, delivery_type_code, cart_items = [], date } = params;

  let deliveryType = delivery_type_id
    ? await repo.getDeliveryType(delivery_type_id)
    : await repo.getDeliveryTypeByCode(delivery_type_code);

  if (!deliveryType) throw { statusCode: 404, message: 'Type de livraison introuvable' };

  const checkDate = targetDate(date);

  if (HOME_LIKE_CODES.includes(deliveryType.code)) {
    if (!address_id) throw { statusCode: 400, message: 'address_id requis pour livraison à domicile' };

    // Nœud déjà choisi explicitement (ex: création manuelle back-office) —
    // on l'utilise directement au lieu de le recalculer via l'adresse,
    // sinon findEligibleNodes peut écarter ce nœud (ville non matchée,
    // hors rayon...) et renvoyer silencieusement 0 créneau.
    if (node_id) {
      const node = await repo.getNodeById(node_id);
      if (!node) throw { statusCode: 404, message: 'Node introuvable' };

      const daySlots  = await repo.getSlotsForNodeAndDate(node_id, checkDate);
      const enriched  = await enrichSlots(daySlots, checkDate);
      const available = enriched.filter(s => !s.is_full && !s.is_past);

      return {
        delivery_type: deliveryType,
        node: { id: node.id, name_fr: node.name_fr, city: node.city },
        slots: available,
        all_slots: enriched,
        date: checkDate.toISOString().split('T')[0],
      };
    }

    const result = await findEligibleNodes(address_id, cart_items, checkDate);

    if (!result.best_node) {
      return {
        delivery_type: deliveryType, node: null, slots: [], eligible_count: 0,
        message: result.ineligible.length ? 'Aucun node éligible pour cette adresse' : 'Aucun node disponible dans cette ville',
        debug: { ineligible: result.ineligible },
        date: checkDate.toISOString().split('T')[0],
      };
    }

    const node  = result.best_node;
    const enriched = await enrichSlots(node.day_slots, checkDate);
    const available = enriched.filter(s => !s.is_full && !s.is_past);

    return {
      delivery_type: deliveryType,
      node: { id: node.id, name_fr: node.name_fr, distance_km: node.distance_km, city: node.city },
      slots: available, all_slots: enriched,
      eligible_count: result.eligible.length,
      date: checkDate.toISOString().split('T')[0],
    };
  }

  if (PICKUP_LIKE_CODES.includes(deliveryType.code)) {
    if (node_id) {
      const node = await repo.getNodeById(node_id);
      if (!node) throw { statusCode: 404, message: 'Node introuvable' };
      const daySlots  = await repo.getSlotsForNodeAndDate(node_id, checkDate);
      const enriched  = await enrichSlots(daySlots, checkDate);
      const available = enriched.filter(s => !s.is_full && !s.is_past);
      return { delivery_type: deliveryType, node, slots: available, all_slots: enriched, date: checkDate.toISOString().split('T')[0] };
    }

    const allNodes = await repo.getAllActiveNodes();
    const pickupNodes = await Promise.all(
      allNodes.map(async (n) => {
        const daySlots  = await repo.getSlotsForNodeAndDate(n.id, checkDate);
        const enriched  = await enrichSlots(daySlots, checkDate);
        const available = enriched.filter(s => !s.is_full && !s.is_past);
        return { id: n.id, name_fr: n.name_fr, name_ar: n.name_ar, city: n.city, slots: available, all_slots: enriched };
      })
    );
    return { delivery_type: deliveryType, pickup_nodes: pickupNodes, date: checkDate.toISOString().split('T')[0] };
  }

  throw { statusCode: 400, message: `Type de livraison «${deliveryType.code}» non supporté` };
}

// ── CREATE ORDER ──────────────────────────────────────────────────────────────
async function createOrder(payload) {
  const {
    customer_id, address_id,
    delivery_type_id, delivery_type_code,
    node_id, selected_slot_id,
    payment_method_id, payment_method_code,
    cart_items, notes, date,
    wallet_used: walletRequested = 0,
    promo_code = null,
    initial_status_code = 'PENDING',
  } = payload;

  if (!customer_id)        throw { statusCode: 400, message: 'customer_id requis' };
  if (!cart_items?.length) throw { statusCode: 400, message: 'Panier vide — cart_items requis' };

  for (const [i, item] of cart_items.entries()) {
    if (!item.sku_id && !item.pack_id) throw { statusCode: 400, message: `cart_items[${i}]: sku_id ou pack_id requis` };
    if (!Number(item.qty) || Number(item.qty) <= 0) throw { statusCode: 400, message: `cart_items[${i}]: qty doit être > 0` };
  }

  const customer = await repo.getCustomer(customer_id);
  if (!customer)          throw { statusCode: 404, message: 'Client introuvable' };
  if (!customer.is_active) throw { statusCode: 403, message: 'Compte client bloqué' };

  const deliveryType = delivery_type_id
    ? await repo.getDeliveryType(delivery_type_id)
    : await repo.getDeliveryTypeByCode(delivery_type_code);
  if (!deliveryType) throw { statusCode: 404, message: 'Type de livraison introuvable' };

  const checkDate = targetDate(date);

  let finalNodeId    = node_id || null;
  let needsBackorder = false;

  if (HOME_LIKE_CODES.includes(deliveryType.code)) {
    if (!address_id) throw { statusCode: 400, message: 'address_id requis pour livraison à domicile' };
    if (finalNodeId) {
      const s = await checkStock(finalNodeId, cart_items, { strict: false });
      needsBackorder = s.needs_backorder || !s.ok;
    } else {
      const result = await findEligibleNodes(address_id, cart_items, checkDate);
      if (!result.best_node) {
        const details = result.ineligible.map(n => `${n.name_fr}: ${n.reasons.map(r => r.code).join(', ')}`).join(' | ');
        throw { statusCode: 422, message: 'Aucun node éligible pour cette adresse et ce panier', debug: details };
      }
      finalNodeId    = result.best_node.id;
      needsBackorder = result.best_node.needs_backorder;
    }
  } else {
    if (!finalNodeId) throw { statusCode: 400, message: 'node_id requis pour retrait magasin' };
    const s = await checkStock(finalNodeId, cart_items, { strict: false });
    needsBackorder = s.needs_backorder;
  }

  const targetCode = initial_status_code;
  const [orderStatusRow, activeItem, pendingPayment, reservationMoveType, debitTxnType] = await Promise.all([
    repo.getOrderStatusByCode(targetCode).then(s => s || repo.getOrderStatusByCode('PENDING')),
    repo.getOrderItemStatusByCode('PENDING'),
    repo.getPaymentStatusByCode('PENDING'),
    prisma.moveType.findFirst({ where: { code: { in: ['reservation', 'RESERVATION', 'reserve'] } } }),
    prisma.walletTxnType.findFirst({ where: { code: 'debit_order' } }),
  ]);
  const orderStatus = orderStatusRow;
  if (!orderStatus) throw { statusCode: 500, message: 'Statut commande introuvable — lancez le seed' };
  if (!activeItem)  throw { statusCode: 500, message: 'Statut ligne "PENDING" introuvable — lancez le seed' };

  const paymentMethod = payment_method_id
    ? await repo.getPaymentMethod(payment_method_id)
    : payment_method_code
      ? await repo.getPaymentMethodByCode(payment_method_code)
      : null;

  if (!paymentMethod) {
    throw { statusCode: 400, message: 'Mode de paiement invalide ou manquant' };
  }

  const paymentMethodId = paymentMethod.id;

  if (!pendingPayment) {
    throw { statusCode: 500, message: 'Statut de paiement "PENDING" introuvable — lancez le seed' };
  }

  const configs        = await repo.getAppConfigs(finalNodeId);
  const deliveryFeeConf     = parseFloat(configs['delivery_fee'] ?? configs['delivery_fee_home'] ?? 0);
  const freeDeliveryThreshold = parseFloat(configs['free_delivery_threshold'] ?? 0);

  let subtotal_ht = 0;
  let vat_amount  = 0;
  const itemsData = [];

  for (const item of cart_items) {
    const qty    = Number(item.qty || 1);
    const priced = await resolveItemPrice(finalNodeId, item);

    const lineHT = priced.unit_price / (1 + priced.vat_rate / 100);
    subtotal_ht += lineHT * qty;
    vat_amount  += (priced.unit_price - lineHT) * qty;

    itemsData.push({
      sku_id:          item.sku_id  || null,
      pack_id:         item.pack_id || null,
      status_id:       activeItem.id,
      qty,
      unit_price_sold: priced.unit_price,
      discount_amount: 0,
      vat_rate:        priced.vat_rate,
      node_id:         finalNodeId,
    });
  }

  subtotal_ht = parseFloat(subtotal_ht.toFixed(2));
  vat_amount  = parseFloat(vat_amount.toFixed(2));
  const subtotal_ttc = parseFloat((subtotal_ht + vat_amount).toFixed(2));

  let discount_amount = 0;
  let appliedPromo    = null;
  let couponFreeShipping = false;
  if (promo_code) {
    const { validateCoupon, computeCouponDiscount } = require('../coupons/coupons.shared');
    appliedPromo = await validateCoupon(promo_code.toUpperCase().trim(), customer_id, subtotal_ttc);
    const res = computeCouponDiscount(appliedPromo, subtotal_ttc, 0);
    discount_amount    = res.discount;
    couponFreeShipping = res.free_shipping;
  }

  let delivery_fee = 0;
  if (!PICKUP_LIKE_CODES.includes(deliveryType.code)) {
    delivery_fee = (freeDeliveryThreshold > 0 && subtotal_ttc >= freeDeliveryThreshold)
      ? 0 : deliveryFeeConf;
  }

  if (couponFreeShipping) {
    discount_amount = parseFloat(delivery_fee.toFixed(2));
  }
  discount_amount = parseFloat(Math.min(discount_amount, subtotal_ttc).toFixed(2));

  const maxWallet = Math.min(Number(customer.wallet_balance ?? 0), Number(walletRequested));
  const wallet_used = parseFloat(Math.max(0, maxWallet).toFixed(2));

  const total_ttc  = parseFloat(Math.max(0, subtotal_ttc + delivery_fee - discount_amount - wallet_used).toFixed(2));
  const normalizedPaymentCode = String(paymentMethod.code || '').trim().toLowerCase();
  const cod_amount = ['cod', 'cash'].includes(normalizedPaymentCode)
    ? total_ttc
    : 0;

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        customer_id,
        node_id:           finalNodeId,
        address_id:        address_id || null,
        status_id:         orderStatus.id,
        delivery_type_id:  deliveryType.id,
        confirmed_slot_id: selected_slot_id || null,
        promotion_id:      appliedPromo?.id || null,
        subtotal_ht,
        vat_amount,
        delivery_fee:      parseFloat(delivery_fee.toFixed(2)),
        discount_amount,
        wallet_used,
        total_ttc,
        cod_amount,
        notes:             notes || null,
        items:             { create: itemsData },
      },
      include: {
        items:        true,
        status:       true,
        delivery_type: true,
        node:         { select: { id: true, name_fr: true, code: true } },
        customer:     { select: { id: true, name: true, phone_number: true } },
        payments: {
          include: { payment_method: true, status: true },
        },
      },
    });

    const cartSkuIds   = cart_items.filter(i => i.sku_id).map(i => i.sku_id);
    const sellingRules = cartSkuIds.length
      ? await tx.sellingRule.findMany({ where: { node_id: finalNodeId, sku_id: { in: cartSkuIds } } })
      : [];
    const txRuleMap = Object.fromEntries(sellingRules.map(r => [r.sku_id, r]));

    for (const item of cart_items) {
      if (!item.sku_id) continue;
      const qty  = Number(item.qty || 1);
      const rule = txRuleMap[item.sku_id];

      const upd = await tx.stockLevel.updateMany({
        where: { node_id: finalNodeId, sku_id: item.sku_id, qty_available: { gte: qty } },
        data:  { qty_reserved: { increment: qty }, qty_available: { decrement: qty } },
      });

      if (upd.count === 1) {
        if (reservationMoveType) {
          await tx.stockMove.create({
            data: {
              node_id:      finalNodeId,
              sku_id:       item.sku_id,
              move_type_id: reservationMoveType.id,
              order_id:     newOrder.id,
              qty_delta:    0,
              reason:       `Réservation commande ${newOrder.id.slice(0, 8)}`,
            },
          });
        }
      } else {
        const stock = await tx.stockLevel.findUnique({
          where: { node_id_sku_id: { node_id: finalNodeId, sku_id: item.sku_id } },
        });
        const avail = stock ? Number(stock.qty_available) : 0;
        const shortage = qty - avail;

        if (rule?.is_backorderable && (!rule.backorder_limit || Number(rule.backorder_limit) >= shortage)) {
          const toReserve   = Math.max(0, avail);
          const toBackorder = qty - toReserve;

          await tx.stockLevel.updateMany({
            where: { node_id: finalNodeId, sku_id: item.sku_id },
            data: {
              qty_reserved:    { increment: toReserve },
              qty_available:   { decrement: toReserve },
              qty_backordered: { increment: toBackorder },
            },
          });

          await tx.orderItem.updateMany({
            where: { order_id: newOrder.id, sku_id: item.sku_id },
            data:  { qty_backordered: toBackorder },
          });

          if (reservationMoveType) {
            await tx.stockMove.create({
              data: {
                node_id:      finalNodeId,
                sku_id:       item.sku_id,
                move_type_id: reservationMoveType.id,
                order_id:     newOrder.id,
                qty_delta:    0,
                reason:       `Réservation partielle + backorder ${toBackorder} — commande ${newOrder.id.slice(0, 8)}`,
              },
            });
          }
        } else {
          const toBackorder = qty;
          await tx.stockLevel.updateMany({
            where: { node_id: finalNodeId, sku_id: item.sku_id },
            data:  { qty_backordered: { increment: toBackorder } },
          });
          await tx.orderItem.updateMany({
            where: { order_id: newOrder.id, sku_id: item.sku_id },
            data:  { qty_backordered: toBackorder },
          });
          if (reservationMoveType) {
            await tx.stockMove.create({
              data: {
                node_id: finalNodeId, sku_id: item.sku_id,
                move_type_id: reservationMoveType.id, order_id: newOrder.id,
                qty_delta: 0,
                reason: `Backorder forcé (stock épuisé: ${avail}/${qty}) — substitution à venir — commande ${newOrder.id.slice(0, 8)}`,
              },
            });
          }
        }
      }
    }

    if (wallet_used > 0) {
      const walletBefore = Number(customer.wallet_balance ?? 0);
      const walletAfter  = Math.max(0, walletBefore - wallet_used);
      await tx.customer.update({
        where: { id: customer_id },
        data:  { wallet_balance: walletAfter },
      });
      if (debitTxnType) {
        await tx.walletTransaction.create({
          data: {
            customer_id,
            txn_type_id:    debitTxnType.id,
            order_id:       newOrder.id,
            amount:         wallet_used,
            balance_before: walletBefore,
            balance_after:  walletAfter,
            note:           `Débit commande #${newOrder.id.slice(0, 8)}`,
          },
        });
      }
    }

    await tx.payment.create({
      data: {
        order_id:          newOrder.id,
        status_id:         pendingPayment.id,
        payment_method_id: paymentMethodId,
        amount:            total_ttc,
        currency:          'MAD',
      },
    });

    if (appliedPromo) {
      await tx.couponRedemption.create({
        data: {
          promotion_id:     appliedPromo.id,
          customer_id,
          order_id:         newOrder.id,
          discount_applied: discount_amount,
        },
      });
      await tx.promotion.update({
        where: { id: appliedPromo.id },
        data:  { uses_count: { increment: 1 } },
      });
    }

    const histNote = initial_status_code === 'CONFIRMED'
      ? 'Commande créée et confirmée automatiquement'
      : 'Commande créée depuis le back-office';
    await tx.orderHistory.create({
      data: { order_id: newOrder.id, status_id: orderStatus.id, note: histNote },
    });

    return newOrder;
  });

  if (
    String(order.status?.code || '').toUpperCase() === 'CONFIRMED' ||
    String(orderStatus.code || '').toUpperCase() === 'CONFIRMED'
  ) {
    try {
      const { emitNewOrder } = require('../../socket/picker.socket');
      const itemCount = order.items?.length ?? 0;
      emitNewOrder(finalNodeId, {
        order_id:      order.id,
        reference:     order.id.slice(0, 8).toUpperCase(),
        customer_name: order.customer?.name ?? 'Client',
        total_ttc:     Number(order.total_ttc ?? 0).toFixed(2),
        items_count:   itemCount,
        created_at:    order.created_at ?? new Date().toISOString(),
      });
    } catch (_) { /* Socket optionnel — ne pas bloquer */ }
  }

  return order;
}

module.exports = {
  getMeta, getAvailableDates, calculate, findEligibleNodes, findPickupNodes,
  getDeliverySlots, createOrder, checkStock,
  HOME_LIKE_CODES, PICKUP_LIKE_CODES,
};