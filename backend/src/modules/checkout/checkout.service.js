const prisma = require('../../config/database');
const repo   = require('./checkout.repository');
const { resolveItemPrice, resolvePackPrice } = require('./pricing.shared');
const { getNodeOrderSettings } = require('./node_settings');
const { audit } = require('../../utils/audit');

// ── Groupes de codes équivalents (référentiel en minuscules : home / pickup) ──
const HOME_LIKE_CODES   = ['home', 'home_delivery', 'scheduled', 'HOME', 'HOME_DELIVERY', 'SCHEDULED'];
const PICKUP_LIKE_CODES = ['pickup', 'in_store', 'PICKUP', 'IN_STORE'];
const isHome   = (code) => ['home', 'home_delivery', 'scheduled'].includes(String(code || '').toLowerCase());
const isPickup = (code) => ['pickup', 'in_store'].includes(String(code || '').toLowerCase());

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
async function checkStock(node_id, raw_items, { strict = false } = {}) {
  // Pack au format back-office ({ pack_id, qty } sans sku_id) : contrôle sur ses composants.
  let cart_items = raw_items;
  const headerPacks = [...new Set(raw_items.filter((i) => i.pack_id && !i.sku_id).map((i) => i.pack_id))];
  if (headerPacks.length) {
    const recipes = await prisma.packItem.findMany({ where: { pack_id: { in: headerPacks } }, select: { pack_id: true, sku_id: true, qty: true } });
    cart_items = raw_items.flatMap((i) => (i.pack_id && !i.sku_id
      ? recipes.filter((r) => r.pack_id === i.pack_id).map((r) => ({ pack_id: i.pack_id, sku_id: r.sku_id, qty: Number(r.qty) * Number(i.qty || 1) }))
      : [i]));
  }
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
    const limit = Number(rule?.backorder_limit ?? 0);
    if (rule?.is_backorderable && (limit === 0 || Number(rule.backordered_quantity ?? 0) + shortage <= limit)) {
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

async function safeNodeSettings(node_id) {
  try {
    const s = await getNodeOrderSettings(node_id);
    return {
      delivery_fee: s.delivery_fee,
      min_order_amount: s.min_order_amount,
      slot_selection_enabled: s.slot_selection_enabled,
      free_delivery_threshold: s.free_delivery_threshold,
      sources: s.sources,
    };
  } catch { return null; }
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
    node_settings: nodeData ? await safeNodeSettings(nodeData.id) : null,
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

// ── Panier : expansion des packs ─────────────────────────────────────────────
/**
 * Regroupe les packs du panier en lignes d'EN-TÊTE (Schema_V3 order_items) :
 *   { pack_id, qty: nombre_de_packs, _header: true }
 * Deux formats acceptés :
 *   - back-office : { pack_id, qty } (sans sku_id) = qty packs ;
 *   - app client  : lignes composants déjà développées { pack_id, sku_id, qty = nb_packs × qty_composant }
 *     → nombre de packs = qty / qty du composant dans la recette (max sur les composants).
 * Les lignes composants (sku_id, parent_item_id → en-tête) sont créées à la validation.
 * Renvoie { lines, packs: { [pack_id]: { pack, count } } }.
 */
async function expandCart(node_id, cart_items, db = prisma) {
  const lines = [];
  const packs = {};
  const packIds = [...new Set(cart_items.filter((i) => i.pack_id).map((i) => i.pack_id))];
  const packRows = packIds.length
    ? await db.pack.findMany({ where: { id: { in: packIds } }, include: { pack_items: { orderBy: { sort_order: 'asc' } } } })
    : [];
  const packMap = Object.fromEntries(packRows.map((p) => [p.id, p]));
  const now = new Date();
  const headerIdx = {};
  const headerCount = {};
  const clientCount = {};

  for (const [i, item] of cart_items.entries()) {
    const qty = Number(item.qty || 1);
    if (!item.pack_id) { lines.push({ ...item, qty }); continue; }

    const pack = packMap[item.pack_id];
    if (!pack || pack.is_deleted || !pack.is_active) throw { statusCode: 404, message: `Pack introuvable ou inactif (ligne ${i + 1})` };
    if (pack.node_id && node_id && pack.node_id !== node_id) throw { statusCode: 422, message: `Le pack « ${pack.name_fr} » n'est pas proposé sur ce nœud` };
    if (pack.valid_from && new Date(pack.valid_from) > now) throw { statusCode: 422, message: `Le pack « ${pack.name_fr} » n'est pas encore disponible` };
    if (pack.valid_to && new Date(pack.valid_to) < now) throw { statusCode: 422, message: `Le pack « ${pack.name_fr} » est expiré` };
    if (!pack.pack_items.length) throw { statusCode: 422, message: `Le pack « ${pack.name_fr} » n'a aucun composant` };

    if (!(pack.id in headerIdx)) {
      headerIdx[pack.id] = lines.length;
      lines.push({ pack_id: pack.id, qty: 0, _header: true });
      headerCount[pack.id] = 0;
      clientCount[pack.id] = 0;
    }
    if (!item.sku_id) {
      if (!Number.isInteger(qty) || qty <= 0) throw { statusCode: 400, message: `Quantité de pack invalide (ligne ${i + 1})` };
      headerCount[pack.id] += qty;
    } else {
      const recipe = pack.pack_items.find((pi) => pi.sku_id === item.sku_id);
      if (!recipe) throw { statusCode: 400, message: `Ce produit n'appartient pas au pack « ${pack.name_fr} » (ligne ${i + 1})` };
      const per = Number(recipe.qty || 1);
      clientCount[pack.id] = Math.max(clientCount[pack.id], Math.max(1, Math.round(qty / per)));
    }
  }
  for (const [packId, idx] of Object.entries(headerIdx)) {
    const count = headerCount[packId] + clientCount[packId];
    lines[idx].qty = count;
    packs[packId] = { pack: packMap[packId], count };
  }
  return { lines, packs };
}

/** Plafond commercial restant du pack : max_pack_qty − sold_count (null = illimité). */
function packRemaining(pack) {
  if (pack.max_pack_qty == null) return null;
  return Math.max(0, Number(pack.max_pack_qty) - Number(pack.sold_count || 0));
}

/**
 * Refuse un pack indisponible (WF #16 / #27 — US-099) : inactif, plafond atteint
 * ou composants non assemblables (sauf pack vendable en rupture).
 */
async function assertPacksSellable(packs) {
  const { getPackSellableInfo } = require('../pack/pack.shared');
  for (const { pack, count } of Object.values(packs)) {
    const info = await getPackSellableInfo(pack.id);
    if (!info.is_active) throw { statusCode: 422, message: `Le pack « ${pack.name_fr} » est désactivé.` };
    if (info.remaining_cap !== null && count > info.remaining_cap) {
      throw { statusCode: 409, message: `Plafond du pack « ${pack.name_fr} » : il reste ${info.remaining_cap} pack(s) vendable(s), ${count} demandé(s).` };
    }
    if (!info.is_available) {
      throw { statusCode: 422, message: `Le pack « ${pack.name_fr} » est indisponible (plafond atteint ou composants en rupture).` };
    }
    if (!info.is_backorderable && info.vendable_count !== null && count > info.vendable_count) {
      throw { statusCode: 422, message: `Le pack « ${pack.name_fr} » : ${info.vendable_count} pack(s) assemblable(s) seulement, ${count} demandé(s).` };
    }
  }
}

/** Le panier bénéficie-t-il déjà d'une offre (vente flash ou pack remisé) ? — non-cumul is_combined (US-076). */
function hasOtherOffer(priced) {
  return priced.some(({ item, priced: p }) => !!p.flash_sale_id || (!!item.pack_id && !!p.pack_discounted));
}

/**
 * Quantités « vente flash » par vente flash : SKU = quantité de la ligne,
 * pack = nombre de packs commandés (une seule fois par pack).
 */
function flashQuantities(priced) {
  const out = {};
  for (const { item, qty, priced: p } of priced) {
    if (!p.flash_sale_id) continue;
    const fsId = p.flash_sale_id;
    const n = Math.max(1, Math.round(Number(qty)));
    out[fsId] = { fs: p.flash_sale, qty: (out[fsId]?.qty || 0) + n, pack: !!item._header };
  }
  return out;
}

/**
 * Incrémente flash_sales.sold_count (atomique, plafond stock_flash) et contrôle
 * la limite par client max_qty_per_user (lignes non annulées des commandes précédentes).
 */
async function consumeFlashSales(tx, customer_id, flashQty) {
  const L = require('../orders_mgmt/order_lifecycle');
  const applied = [];
  for (const [fsId, { fs, qty, pack }] of Object.entries(flashQty)) {
    const label = fs?.name_fr || 'Vente flash';
    if (fs?.max_qty_per_user) {
      const prior = await tx.orderItem.findMany({
        where: {
          flash_sale_id: fsId,
          order: { customer_id, is_deleted: false, status: { code: { not: 'cancelled' } } },
        },
        select: { pack_id: true, sku_id: true, qty: true },
      });
      const already = pack
        ? Object.values(await L.countPacks(prior, tx)).reduce((a, b) => a + b, 0)
        : prior.reduce((a, l) => a + Number(l.qty), 0);
      if (already + qty > fs.max_qty_per_user) {
        throw { statusCode: 409, message: `« ${label} » : limite de ${fs.max_qty_per_user} par client (déjà ${already}, demandé ${qty}).` };
      }
    }
    const rows = await tx.$queryRaw`
      UPDATE flash_sales SET sold_count = sold_count + ${qty}::int, updated_at = now()
       WHERE id = ${fsId}::uuid AND (stock_flash IS NULL OR sold_count + ${qty}::int <= stock_flash)
      RETURNING sold_count, stock_flash`;
    if (!rows.length) {
      throw { statusCode: 409, message: `« ${label} » : quota de la vente flash épuisé, recalculez le panier.` };
    }
    applied.push({ flash_sale_id: fsId, qty, sold_count: Number(rows[0].sold_count) });
  }
  return applied;
}

// ── Totaux (partagés calculate / createOrder) ────────────────────────────────
/**
 * Sous-totaux calculés sur les lignes de PREMIER NIVEAU uniquement : produits seuls
 * et en-têtes de pack (prix du pack × nombre de packs). Les composants d'un pack
 * ne portent aucun prix (0) : aucun double comptage.
 */
async function priceLines(node_id, lines) {
  let ht = 0;
  let ttc = 0;
  let paid_subtotal_ttc = 0;
  const priced = [];
  for (const item of lines) {
    const qty = Number(item.qty || 1);
    if (item._header) {
      const p = await resolvePackPrice(node_id, item.pack_id);
      ttc += p.unit_price * qty;
      ht += p.unit_price_ht * qty;
      if (!item.is_points_exchange) paid_subtotal_ttc += p.unit_price * qty;
      priced.push({
        item, qty, priced: p,
        components: p.components.map((c) => ({ ...c, qty_per_pack: c.qty, qty_total: Math.round(c.qty * qty * 1000) / 1000 })),
      });
      continue;
    }
    const p = await resolveItemPrice(node_id, item);
    const lineHT = p.unit_price / (1 + p.vat_rate / 100);
    ht += lineHT * qty;
    ttc += p.unit_price * qty;
    // WF #21 / US-093 : les articles échangés contre des points sont exclus du minimum.
    if (!item.is_points_exchange) paid_subtotal_ttc += p.unit_price * qty;
    priced.push({ item, qty, priced: p });
  }
  const subtotal_ttc = parseFloat(ttc.toFixed(2));
  const vat_amount = parseFloat((ttc - ht).toFixed(2));
  return {
    priced,
    subtotal_ht: parseFloat((subtotal_ttc - vat_amount).toFixed(2)),
    vat_amount,
    subtotal_ttc,
    paid_subtotal_ttc: parseFloat(paid_subtotal_ttc.toFixed(2)),
  };
}

function computeDeliveryFee(settings, deliveryTypeCode, subtotal_ttc) {
  if (isPickup(deliveryTypeCode)) return 0;
  const threshold = Number(settings.free_delivery_threshold || 0);
  if (threshold > 0 && subtotal_ttc >= threshold) return 0;
  return Number(settings.delivery_fee || 0);
}

function minimumCheck(settings, paidSubtotal) {
  const min = Number(settings.min_order_amount || 0);
  const gap = min > 0 ? Math.max(0, parseFloat((min - paidSubtotal).toFixed(2))) : 0;
  return { min_order_amount: min, below_minimum: gap > 0, minimum_gap: gap };
}

// ── CALCULATE — server-side cart total ───────────────────────────────────────
async function calculate({ node_id, delivery_type_code, cart_items, payment_method_code, wallet_used = 0, customer_id, promo_code = null, soft_minimum = false }) {
  if (!cart_items?.length) throw { statusCode: 400, message: 'Panier vide' };
  if (!node_id)            throw { statusCode: 400, message: 'node_id requis' };

  const settings = await getNodeOrderSettings(node_id);
  const { lines, packs } = await expandCart(node_id, cart_items);
  let pack_error = null;
  try { await assertPacksSellable(packs); } catch (e) { pack_error = e.message; }
  const totals = await priceLines(node_id, lines);
  const { subtotal_ht, vat_amount, subtotal_ttc, paid_subtotal_ttc } = totals;

  const minimum = minimumCheck(settings, paid_subtotal_ttc);
  if (minimum.below_minimum && !soft_minimum) {
    throw { statusCode: 422, message: `Montant minimum de commande : ${minimum.min_order_amount} MAD (sous-total payé : ${paid_subtotal_ttc} MAD, il manque ${minimum.minimum_gap} MAD)` };
  }

  const delivery_fee = computeDeliveryFee(settings, delivery_type_code, subtotal_ttc);

  let discount_amount = 0;
  let coupon_error    = null;
  if (promo_code) {
    try {
      const { validateCoupon, computeCouponDiscount } = require('../coupons/coupons.shared');
      const promo = await validateCoupon(promo_code.toUpperCase().trim(), customer_id, subtotal_ttc, {
        node_id, has_other_offer: hasOtherOffer(totals.priced),
      });
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
    items: totals.priced.map(({ item, qty, priced, components }) => ({
      sku_id:         item._header ? null : (item.sku_id || null),
      pack_id:        item.pack_id || null,
      is_pack_header: !!item._header,
      ...(components ? {
        components: components.map((c) => ({
          sku_id: c.sku_id, name_fr: c.name_fr, qty: c.qty_total, qty_per_pack: c.qty_per_pack, unit_price_ttc: 0,
        })),
      } : {}),
      name_fr:        priced.name_fr,
      qty,
      unit_price_ttc: priced.unit_price,
      vat_rate:       priced.vat_rate,
      line_total:     parseFloat((priced.unit_price * qty).toFixed(2)),
      price_source:   priced.source,
      flash_sale_id:  priced.flash_sale_id || null,
      flash_sale_name: priced.flash_sale?.name_fr || null,
    })),
    pack_error,
    subtotal_ht,
    vat_amount,
    subtotal_ttc,
    paid_subtotal_ttc,
    delivery_fee:   parseFloat(delivery_fee.toFixed(2)),
    discount_amount,
    coupon_error,
    wallet_used:    wallet_deduction,
    total_ttc,
    cod_amount,
    currency:       'MAD',
    ...minimum,
    slot_selection_enabled: settings.slot_selection_enabled,
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

  if (isHome(deliveryType.code)) {
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

  if (isPickup(deliveryType.code)) {
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
/**
 * @param {object} payload
 * @param {{ source?: 'backoffice'|'customer', req?: object }} ctx
 *   source = 'backoffice' (création manuelle, WF #27 / US-106 / US-108) : contrôles
 *   stricts de vendabilité et de rupture, COD imposé, créneau affecté par le
 *   back-office (capacité non bloquante). Par défaut 'customer' (app mobile).
 */
async function createOrder(payload, ctx = {}) {
  const source = ctx.source === 'backoffice' ? 'backoffice' : 'customer';
  const strict = source === 'backoffice';
  const req = ctx.req || null;
  const {
    customer_id, address_id,
    delivery_type_id, delivery_type_code,
    node_id, selected_slot_id,
    slot_preference_ids = [],
    payment_method_id, payment_method_code,
    cart_items, notes, date,
    wallet_used: walletRequested = 0,
    promo_code = null,
    initial_status_code = 'pending',
  } = payload;

  if (!customer_id)        throw { statusCode: 400, message: 'customer_id requis' };
  if (!cart_items?.length) throw { statusCode: 400, message: 'Panier vide — cart_items requis' };

  for (const [i, item] of cart_items.entries()) {
    if (!item.sku_id && !item.pack_id) throw { statusCode: 400, message: `cart_items[${i}]: sku_id ou pack_id requis` };
    if (!Number(item.qty) || Number(item.qty) <= 0) throw { statusCode: 400, message: `cart_items[${i}]: qty doit être > 0` };
  }

  const customer = await repo.getCustomer(customer_id);
  if (!customer)           throw { statusCode: 404, message: 'Client introuvable' };
  if (!customer.is_active) throw { statusCode: 403, message: 'Compte client bloqué' };

  const deliveryType = delivery_type_id
    ? await repo.getDeliveryType(delivery_type_id)
    : await repo.getDeliveryTypeByCode(delivery_type_code || 'home');
  if (!deliveryType) throw { statusCode: 404, message: 'Type de livraison introuvable' };

  const checkDate = targetDate(date);
  let finalNodeId = node_id || null;

  if (isHome(deliveryType.code)) {
    if (!address_id) throw { statusCode: 400, message: 'Adresse de livraison requise pour une livraison à domicile' };
    if (!finalNodeId) {
      const result = await findEligibleNodes(address_id, cart_items, checkDate);
      if (!result.best_node) {
        const details = result.ineligible.map(n => `${n.name_fr}: ${n.reasons.map(r => r.code).join(', ')}`).join(' | ');
        throw { statusCode: 422, message: 'Aucun node éligible pour cette adresse et ce panier', debug: details };
      }
      finalNodeId = result.best_node.id;
    }
  } else if (!finalNodeId) {
    throw { statusCode: 400, message: 'node_id requis pour retrait magasin' };
  }

  const node = await repo.getNodeById(finalNodeId);
  if (!node) throw { statusCode: 404, message: 'Nœud introuvable ou inactif' };
  if (address_id) {
    const addr = await repo.getAddress(address_id);
    if (!addr || addr.customer_id !== customer_id) throw { statusCode: 422, message: "L'adresse ne correspond pas à ce client" };
  }

  const settings = await getNodeOrderSettings(finalNodeId);

  // ── Articles : développement des packs + plafond commercial ────────────────
  const { lines, packs } = await expandCart(finalNodeId, cart_items);
  for (const { pack, count } of Object.values(packs)) {
    const rem = packRemaining(pack);
    if (rem !== null && count > rem) {
      throw { statusCode: 409, message: `Plafond du pack « ${pack.name_fr} » : il reste ${rem} pack(s) vendable(s), ${count} demandé(s).` };
    }
  }
  await assertPacksSellable(packs);

  const totals = await priceLines(finalNodeId, lines);
  const { subtotal_ht, vat_amount, subtotal_ttc, paid_subtotal_ttc } = totals;

  // WF #21 / US-093 : minimum sur le sous-total PAYÉ (échanges de points exclus)
  const minimum = minimumCheck(settings, paid_subtotal_ttc);
  if (minimum.below_minimum) {
    throw { statusCode: 422, message: `Montant minimum de commande non atteint : ${minimum.min_order_amount} MAD requis, sous-total payé ${paid_subtotal_ttc} MAD (il manque ${minimum.minimum_gap} MAD).` };
  }

  // ── Statuts & paiement ─────────────────────────────────────────────────────
  const [orderStatus, activeItem, pendingPayment, debitTxnType] = await Promise.all([
    repo.getOrderStatusByCode(initial_status_code).then(s => s || repo.getOrderStatusByCode('pending')),
    repo.getOrderItemStatusByCode('active').then(s => s || repo.getOrderItemStatusByCode('pending')),
    repo.getPaymentStatusByCode('pending'),
    prisma.walletTxnType.findFirst({ where: { code: 'debit_order' } }),
  ]);
  if (!orderStatus)    throw { statusCode: 500, message: 'Statut commande introuvable — lancez le seed' };
  if (!activeItem)     throw { statusCode: 500, message: 'Statut de ligne « active » introuvable — lancez le seed' };
  if (!pendingPayment) throw { statusCode: 500, message: 'Statut de paiement « pending » introuvable — lancez le seed' };

  // Création back-office : paiement à la livraison uniquement.
  const paymentMethod = strict
    ? await repo.getPaymentMethodByCode('cod')
    : payment_method_id
      ? await repo.getPaymentMethod(payment_method_id)
      : payment_method_code
        ? await repo.getPaymentMethodByCode(payment_method_code)
        : null;
  if (!paymentMethod) {
    throw { statusCode: 400, message: strict ? 'Mode de paiement « Paiement à la livraison » (cod) introuvable ou inactif' : 'Mode de paiement invalide ou manquant' };
  }

  // ── Créneau (WF #3 / #20) ──────────────────────────────────────────────────
  let slot = null;
  let slotWarning = null;
  if (selected_slot_id) {
    slot = await prisma.deliverySlot.findUnique({ where: { id: selected_slot_id } });
    if (!slot || slot.node_id !== finalNodeId) throw { statusCode: 422, message: "Le créneau choisi n'appartient pas à ce nœud" };
    if (!slot.is_active) throw { statusCode: 422, message: 'Le créneau choisi est désactivé' };
    if (!strict && !settings.slot_selection_enabled) {
      slot = null; // sélection désactivée : le client ne choisit pas, l'équipe affectera plus tard
    } else {
      const used = await repo.countOrdersForSlotDay(slot.id);
      if (slot.max_orders != null && used >= slot.max_orders) {
        if (strict) slotWarning = `Créneau complet (${used}/${slot.max_orders}) — affecté malgré tout`;
        else throw { statusCode: 409, message: 'Ce créneau est complet, choisissez-en un autre' };
      }
    }
  }
  const sourceRow = slot
    ? await prisma.slotAssignmentSource.findFirst({ where: { code: { equals: strict ? 'backoffice' : 'customer', mode: 'insensitive' } } })
    : null;
  const slotDate = slot ? slot.specific_date.toISOString().slice(0, 10) : null;
  const L = require('../orders_mgmt/order_lifecycle');

  // ── Promo, frais, wallet ───────────────────────────────────────────────────
  let discount_amount = 0;
  let appliedPromo    = null;
  let couponFreeShipping = false;
  if (promo_code && String(promo_code).trim()) {
    const { validateCoupon, computeCouponDiscount } = require('../coupons/coupons.shared');
    appliedPromo = await validateCoupon(String(promo_code).toUpperCase().trim(), customer_id, subtotal_ttc, {
      node_id: finalNodeId,
      has_other_offer: hasOtherOffer(totals.priced),
    });
    const res = computeCouponDiscount(appliedPromo, subtotal_ttc, 0);
    discount_amount    = res.discount;
    couponFreeShipping = res.free_shipping;
  }

  const delivery_fee = computeDeliveryFee(settings, deliveryType.code, subtotal_ttc);
  if (couponFreeShipping) discount_amount = parseFloat(delivery_fee.toFixed(2));
  discount_amount = parseFloat(Math.min(discount_amount, subtotal_ttc).toFixed(2));

  const maxWallet = strict ? 0 : Math.min(Number(customer.wallet_balance ?? 0), Number(walletRequested));
  const wallet_used = parseFloat(Math.max(0, maxWallet).toFixed(2));

  const total_ttc  = parseFloat(Math.max(0, subtotal_ttc + delivery_fee - discount_amount - wallet_used).toFixed(2));
  const cod_amount = ['cod', 'cash'].includes(String(paymentMethod.code || '').trim().toLowerCase()) ? total_ttc : 0;
  const skuNames = {};
  for (const { item, priced, components } of totals.priced) {
    if (components) for (const c of components) skuNames[c.sku_id] = c.name_fr;
    else if (item.sku_id) skuNames[item.sku_id] = priced.name_fr;
  }

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        customer_id,
        node_id:           finalNodeId,
        address_id:        address_id || null,
        status_id:         orderStatus.id,
        delivery_type_id:  deliveryType.id,
        confirmed_slot_id: slot?.id || null,
        slot_start:        slot ? L.zonedDateTime(slotDate, slot.slot_start, settings.timezone) : null,
        slot_end:          slot ? L.zonedDateTime(slotDate, slot.slot_end, settings.timezone) : null,
        assignment_source_id: sourceRow?.id || null,
        slot_assigned_by:  slot && strict ? (req?.user?.id ?? null) : null,
        promotion_id:      appliedPromo?.id || null,
        subtotal_ht,
        vat_amount,
        delivery_fee:      parseFloat(delivery_fee.toFixed(2)),
        discount_amount,
        wallet_used,
        total_ttc,
        cod_amount,
        notes:             notes || null,
      },
    });

    // Lignes + réservation (US-108) — aucune écriture stock_moves à ce stade.
    // Pack (Schema_V3) : 1 ligne d'en-tête (pack_id, sku_id NULL, qty = nb de packs, prix du pack)
    // + 1 ligne par composant (sku_id, parent_item_id → en-tête, prix 0) : la réservation
    // de stock porte UNIQUEMENT sur les composants.
    const reservations = [];
    let lineCount = 0;
    const reserve = async (line, sku_id, qty, pack) => {
      await tx.$queryRaw`SELECT id FROM stock_levels WHERE node_id = ${finalNodeId}::uuid AND sku_id = ${sku_id}::uuid FOR UPDATE`;
      const [level, rule] = await Promise.all([
        tx.stockLevel.findUnique({ where: { node_id_sku_id: { node_id: finalNodeId, sku_id } } }),
        tx.sellingRule.findUnique({ where: { node_id_sku_id: { node_id: finalNodeId, sku_id } } }),
      ]);
      const name = skuNames[sku_id] || 'Produit';
      if (strict && rule && !rule.is_sellable) {
        throw { statusCode: 422, message: `« ${name} » n'est pas vendable sur ce nœud.` };
      }

      const avail = level ? Math.max(0, Number(level.qty_available)) : 0;
      const toReserve = Math.min(qty, avail);
      const shortage = parseFloat((qty - toReserve).toFixed(3));

      if (shortage > 0) {
        const limit = Number(rule?.backorder_limit ?? 0);
        const already = Number(rule?.backordered_quantity ?? 0);
        const allowed = pack
          ? !!pack.is_backorderable || (!!rule?.is_backorderable && (limit === 0 || already + shortage <= limit))
          : !!rule?.is_backorderable && (limit === 0 || already + shortage <= limit);
        if (!allowed && strict) {
          const why = pack && !pack.is_backorderable
            ? `le pack « ${pack.name_fr} » n'est pas vendable en rupture`
            : !rule?.is_backorderable
              ? 'la vente en rupture n\'est pas autorisée'
              : `plafond de rupture atteint (${already}/${limit})`;
          throw { statusCode: 422, message: `Stock insuffisant pour « ${name} » (disponible ${avail}, demandé ${qty}) : ${why}.` };
        }
      }

      if (level) {
        await tx.stockLevel.update({
          where: { id: level.id },
          data: {
            qty_reserved:    { increment: toReserve },
            qty_available:   { decrement: toReserve },
            qty_backordered: { increment: shortage },
          },
        });
      } else if (shortage > 0) {
        await tx.stockLevel.create({
          data: { node_id: finalNodeId, sku_id, qty_backordered: shortage },
        });
      }
      if (shortage > 0) {
        if (rule) {
          await tx.sellingRule.update({ where: { id: rule.id }, data: { backordered_quantity: { increment: shortage } } });
        }
        await tx.orderItem.update({ where: { id: line.id }, data: { qty_backordered: shortage } });
      }
      reservations.push({ sku_id, reserved: toReserve, backordered: shortage, ...(pack ? { pack_id: pack.id } : {}) });
    };

    for (const { item, qty, priced, components } of totals.priced) {
      if (item._header) {
        const header = await tx.orderItem.create({
          data: {
            order_id:        newOrder.id,
            sku_id:          null,
            pack_id:         item.pack_id,
            status_id:       activeItem.id,
            qty,
            unit_price_sold: priced.unit_price,
            discount_amount: 0,
            vat_rate:        priced.vat_rate,
            node_id:         finalNodeId,
            is_points_exchange: !!item.is_points_exchange,
            points_spent:    Number(item.points_spent || 0),
            flash_sale_id:   priced.flash_sale_id || null,
          },
        });
        lineCount += 1;
        const pack = packs[item.pack_id]?.pack || priced.pack;
        for (const c of components) {
          const comp = await tx.orderItem.create({
            data: {
              order_id:        newOrder.id,
              sku_id:          c.sku_id,
              pack_id:         null,
              parent_item_id:  header.id,
              status_id:       activeItem.id,
              qty:             c.qty_total,
              unit_price_sold: 0,
              discount_amount: 0,
              vat_rate:        c.vat_rate,
              node_id:         finalNodeId,
            },
          });
          lineCount += 1;
          await reserve(comp, c.sku_id, c.qty_total, pack);
        }
        continue;
      }

      const line = await tx.orderItem.create({
        data: {
          order_id:        newOrder.id,
          sku_id:          item.sku_id || null,
          pack_id:         null,
          status_id:       activeItem.id,
          qty,
          unit_price_sold: priced.unit_price,
          discount_amount: 0,
          vat_rate:        priced.vat_rate,
          node_id:         finalNodeId,
          is_points_exchange: !!item.is_points_exchange,
          points_spent:    Number(item.points_spent || 0),
          flash_sale_id:   priced.flash_sale_id || null,
        },
      });
      lineCount += 1;
      if (item.sku_id) await reserve(line, item.sku_id, qty, null);
    }

    // Plafond commercial des packs (WF #27 étape 4d) : sold_count += nb de packs
    const { adjustPackSoldCount } = require('../pack/pack.shared');
    const packSold = {};
    for (const [packId, { count }] of Object.entries(packs)) {
      if (count > 0) packSold[packId] = (await adjustPackSoldCount(packId, count, tx)).sold_count;
    }

    // Ventes flash (WF #27) : quota consommé (sold_count), limite par client contrôlée
    const flashApplied = await consumeFlashSales(tx, customer_id, flashQuantities(totals.priced));

    if (wallet_used > 0) {
      const walletBefore = Number(customer.wallet_balance ?? 0);
      const walletAfter  = Math.max(0, walletBefore - wallet_used);
      await tx.customer.update({ where: { id: customer_id }, data: { wallet_balance: walletAfter } });
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

    // Paiement à encaisser préparé (aucun encaissement à la création)
    await tx.payment.create({
      data: {
        order_id:          newOrder.id,
        status_id:         pendingPayment.id,
        payment_method_id: paymentMethod.id,
        amount:            total_ttc,
        currency:          'MAD',
      },
    });

    if (appliedPromo) {
      await tx.couponRedemption.create({
        data: { promotion_id: appliedPromo.id, customer_id, order_id: newOrder.id, discount_applied: discount_amount },
      });
      await tx.promotion.update({ where: { id: appliedPromo.id }, data: { uses_count: { increment: 1 } } });
      await audit(req, {
        action: 'REDEEM_COUPON', resource: 'promotions', resource_id: appliedPromo.id,
        old_values: { uses_count: appliedPromo.uses_count },
        new_values: { uses_count: appliedPromo.uses_count + 1, order_id: newOrder.id, discount_applied: discount_amount },
      }, tx);
    }

    // Préférences de créneau (app client) : une ligne par créneau choisi
    if (!strict && settings.slot_selection_enabled) {
      const prefIds = [...new Set([...(Array.isArray(slot_preference_ids) ? slot_preference_ids : []), ...(slot ? [slot.id] : [])])];
      if (prefIds.length) {
        const [preferred, confirmed, rejected] = await Promise.all(
          ['preferred', 'confirmed', 'rejected'].map((c) => tx.orderSlotStatus.findFirst({ where: { code: c } })),
        );
        const validSlots = await tx.deliverySlot.findMany({ where: { id: { in: prefIds }, node_id: finalNodeId, is_active: true }, select: { id: true } });
        const validSet = new Set(validSlots.map((s) => s.id));
        let rank = 1;
        for (const sid of prefIds) {
          if (!validSet.has(sid)) continue;
          const status = slot ? (sid === slot.id ? confirmed : rejected) : preferred;
          await tx.orderSlotPreference.create({
            data: { order_id: newOrder.id, slot_id: sid, preference_order: rank++, status_id: status?.id ?? null },
          });
        }
      }
    }

    const histNote = strict
      ? 'Commande créée depuis le back-office'
      : String(orderStatus.code).toLowerCase() === 'confirmed'
        ? 'Commande créée et confirmée automatiquement'
        : 'Commande créée';
    await tx.orderHistory.create({
      data: { order_id: newOrder.id, status_id: orderStatus.id, changed_by: strict ? (req?.user?.id ?? null) : null, note: histNote },
    });

    await audit(req, {
      action: 'CREATE',
      resource: 'orders',
      resource_id: newOrder.id,
      new_values: {
        source,
        customer_id,
        node_id: finalNodeId,
        total_ttc,
        delivery_fee,
        lines: lineCount,
        packs: Object.fromEntries(Object.entries(packs).map(([k, v]) => [k, v.count])),
        packs_sold_count: packSold,
        flash_sales: flashApplied,
        promotion: appliedPromo ? { id: appliedPromo.id, code: appliedPromo.code, discount_amount } : null,
        reservations,
        confirmed_slot_id: slot?.id || null,
        slot_warning: slotWarning,
      },
    }, tx);

    return tx.order.findUnique({
      where: { id: newOrder.id },
      include: {
        items:         true,
        status:        true,
        delivery_type: true,
        node:          { select: { id: true, name_fr: true, code: true } },
        customer:      { select: { id: true, name: true, phone_number: true } },
        confirmed_slot: true,
        payments:      { include: { payment_method: true, status: true } },
      },
    });
  }, { timeout: 30000 });

  // Disponibilité des packs (flag is_available) — non bloquant
  try {
    const { syncPackAvailability } = require('../pack/pack.shared');
    for (const packId of Object.keys(packs)) syncPackAvailability(packId).catch(() => {});
  } catch { /* optionnel */ }

  if (String(order.status?.code || '').toLowerCase() === 'confirmed') {
    try {
      const { emitNewOrder } = require('../../socket/picker.socket');
      emitNewOrder(finalNodeId, {
        order_id:      order.id,
        reference:     order.id.slice(0, 8).toUpperCase(),
        customer_name: order.customer?.name ?? 'Client',
        total_ttc:     Number(order.total_ttc ?? 0).toFixed(2),
        items_count:   order.items?.length ?? 0,
        created_at:    order.created_at ?? new Date().toISOString(),
      });
    } catch (_) { /* Socket optionnel — ne pas bloquer */ }
  }

  return { ...order, slot_warning: slotWarning };
}

// ── Back-office : recherche d'articles vendables sur un nœud (US-106 / US-108) ──
async function searchArticlesForNode({ search, node_id, limit = 20 } = {}) {
  const where = { is_deleted: false, is_active: true };
  if (search?.trim()) {
    const s = search.trim();
    where.OR = [
      { name_fr:  { contains: s, mode: 'insensitive' } },
      { sku_code: { contains: s, mode: 'insensitive' } },
      { ean13:    { contains: s, mode: 'insensitive' } },
    ];
  }
  const skus = await prisma.sku.findMany({
    where,
    take: Math.min(50, Number(limit) || 20),
    orderBy: { name_fr: 'asc' },
    select: {
      id: true, name_fr: true, name_ar: true, sku_code: true, price: true, vat_rate: true,
      tax: { select: { rate: true } },
      ...(node_id ? {
        stock_levels:  { where: { node_id }, select: { qty_available: true, qty_physical: true, qty_reserved: true } },
        selling_rules: { where: { node_id }, select: { is_sellable: true, is_backorderable: true, backorder_limit: true, backordered_quantity: true, estimated_restock_days: true, price: true } },
      } : {}),
    },
  });
  return skus.map((s) => {
    const vat = Number(s.tax?.rate ?? s.vat_rate ?? 20);
    const rule = s.selling_rules?.[0] || null;
    // US-114 : prix du node (TTC) ; repli sur l'ancien prix catalogue HT.
    const price_ttc = rule && Number(rule.price) > 0
      ? Math.round(Number(rule.price) * 100) / 100
      : Math.round(Number(s.price ?? 0) * (1 + vat / 100) * 100) / 100;
    const level = s.stock_levels?.[0] || null;
    const qty_available = level ? Math.max(0, Number(level.qty_available)) : 0;
    const limit = Number(rule?.backorder_limit ?? 0);
    const backorder_remaining = rule?.is_backorderable
      ? (limit === 0 ? null : Math.max(0, limit - Number(rule.backordered_quantity ?? 0)))
      : 0;
    const is_sellable = rule ? !!rule.is_sellable : true;
    let refusal = null;
    if (!is_sellable) refusal = 'Non vendable sur ce nœud';
    else if (qty_available <= 0 && !rule?.is_backorderable) refusal = 'Rupture — vente en rupture non autorisée';
    else if (qty_available <= 0 && backorder_remaining === 0) refusal = 'Rupture — plafond de vente en rupture atteint';
    return {
      id: s.id, sku_id: s.id, name_fr: s.name_fr, name_ar: s.name_ar, sku_code: s.sku_code,
      price: price_ttc, price_ttc, vat_rate: vat,
      has_selling_rule: !!rule,
      is_sellable,
      qty_available,
      is_backorderable: !!rule?.is_backorderable,
      backorder_remaining,
      estimated_restock_days: rule?.estimated_restock_days ?? null,
      max_qty: !is_sellable ? 0 : (rule?.is_backorderable ? (backorder_remaining == null ? null : qty_available + backorder_remaining) : qty_available),
      refusal,
    };
  });
}

// ── Back-office : packs proposés sur un nœud ──────────────────────────────────
async function searchPacksForNode({ search, node_id } = {}) {
  if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
  const now = new Date();
  const { PACK_INCLUDE, computePackAvailability } = require('../pack/pack.shared');
  const packs = await prisma.pack.findMany({
    where: {
      is_deleted: false,
      is_active: true,
      OR: [{ node_id }, { node_id: null }],
      AND: [
        { OR: [{ valid_from: null }, { valid_from: { lte: now } }] },
        { OR: [{ valid_to: null }, { valid_to: { gte: now } }] },
        ...(search?.trim() ? [{ name_fr: { contains: search.trim(), mode: 'insensitive' } }] : []),
      ],
    },
    include: PACK_INCLUDE,
    orderBy: { name_fr: 'asc' },
    take: 30,
  });
  return packs.map((p) => {
    const a = computePackAvailability({ ...p, node_id: p.node_id || node_id });
    return {
      id: p.id,
      pack_id: p.id,
      name_fr: p.name_fr,
      name_ar: p.name_ar,
      price: Number(p.total_price),
      original_price: Number(p.original_price),
      max_pack_qty: p.max_pack_qty,
      sold_count: p.sold_count,
      remaining_cap: a.remainingCap,
      assemblable: a.assemblableCount,
      vendable: a.vendableCount,
      is_backorderable: p.is_backorderable,
      estimated_restock_days: p.estimated_restock_days,
      is_available: a.isAvailable,
      components: (p.pack_items || []).map((it) => ({ sku_id: it.sku_id, name_fr: it.sku?.name_fr, qty: Number(it.qty) })),
      refusal: a.isAvailable ? null
        : (a.remainingCap === 0 ? 'Plafond de vente du pack atteint' : 'Composants en rupture (pack non vendable en rupture)'),
    };
  });
}

// ── Back-office : paramètres de commande du nœud (frais, minimum, créneaux) ──
async function getNodeSummary(node_id) {
  const s = await getNodeOrderSettings(node_id);
  return {
    node_id: s.node_id,
    code: s.node_code,
    name_fr: s.node_name,
    delivery_fee: s.delivery_fee,
    min_order_amount: s.min_order_amount,
    slot_selection_enabled: s.slot_selection_enabled,
    free_delivery_threshold: s.free_delivery_threshold,
    sources: s.sources,
  };
}

// ── Back-office : créneaux datés actifs du nœud (capacité affichée, non bloquante) ──
async function getNodeSlots(node_id, { from, days = 14 } = {}) {
  if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
  const L = require('../orders_mgmt/order_lifecycle');
  const today = new Date();
  const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + Math.min(60, Math.max(1, Number(days) || 14)));
  const slots = await prisma.deliverySlot.findMany({
    where: { node_id, is_active: true, specific_date: { gte: start, lt: end } },
    orderBy: [{ specific_date: 'asc' }, { slot_start: 'asc' }],
  });
  const enriched = await L.enrichSlotsCapacity(slots);
  return enriched.map((s) => ({ ...s, is_past: !isSlotStillValid(s, new Date(`${s.date}T12:00:00`)) }));
}

// ── Back-office : nouveau client (onglet Client) ──────────────────────────────
function referralCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

async function createCustomer({ name, phone_country = '+212', phone_number, city_id } = {}, req = null) {
  const cleanName = String(name ?? '').trim();
  const phone = String(phone_number ?? '').replace(/\s/g, '').replace(/^0/, '');
  if (!cleanName) throw { statusCode: 400, message: 'Le nom du client est obligatoire' };
  if (!/^\d{8,12}$/.test(phone)) throw { statusCode: 400, message: 'Numéro de téléphone invalide (8 à 12 chiffres)' };
  const country = String(phone_country || '+212').trim().slice(0, 5);

  const existing = await prisma.customer.findFirst({ where: { phone_country: country, phone_number: phone, is_deleted: false } });
  if (existing) throw { statusCode: 409, message: `Un client existe déjà avec ce numéro : ${existing.name}` };

  let cityName = null;
  if (city_id) {
    const city = await prisma.city.findFirst({ where: { id: city_id, is_deleted: false } });
    if (!city) throw { statusCode: 404, message: 'Ville introuvable' };
    cityName = city.name_fr;
  }

  let code = referralCode();
  for (let i = 0; i < 5 && await prisma.customer.findUnique({ where: { referral_code: code } }); i++) code = referralCode();

  const customer = await prisma.customer.create({
    data: {
      name: cleanName.slice(0, 150),
      phone_country: country,
      phone_number: phone,
      referral_code: code,
      city_id: city_id || null,
      city: cityName,
    },
    select: { id: true, name: true, phone_country: true, phone_number: true, wallet_balance: true, city: true, is_active: true },
  });
  await audit(req, { action: 'CREATE', resource: 'customers', resource_id: customer.id, new_values: { ...customer, source: 'backoffice_order' } });
  return customer;
}

// ── Back-office : nouvelle adresse rattachée à une ville (onglet Adresse) ─────
async function createAddress(customer_id, data = {}, req = null) {
  const customer = await repo.getCustomer(customer_id);
  if (!customer) throw { statusCode: 404, message: 'Client introuvable' };
  const street = String(data.street_name ?? '').trim();
  if (!street) throw { statusCode: 400, message: 'La rue / adresse est obligatoire' };
  if (!data.city_id) throw { statusCode: 400, message: "La ville est obligatoire (l'adresse doit être rattachée à une ville)" };
  const city = await prisma.city.findFirst({ where: { id: data.city_id, is_deleted: false } });
  if (!city) throw { statusCode: 404, message: 'Ville introuvable' };
  const postal = data.postal_code ? String(data.postal_code).trim() : null;
  if (postal && !/^\d{5}$/.test(postal)) throw { statusCode: 400, message: 'Code postal invalide (5 chiffres)' };

  const hasDefault = await prisma.address.count({ where: { customer_id, is_deleted: false, is_default: true } });
  const address = await prisma.address.create({
    data: {
      customer_id,
      label: data.label?.trim()?.slice(0, 100) || null,
      street_number: data.street_number?.toString().trim().slice(0, 20) || null,
      street_name: street.slice(0, 255),
      quartier: data.quartier?.trim()?.slice(0, 100) || null,
      city: city.name_fr,
      city_id: city.id,
      postal_code: postal,
      delivery_notes: data.delivery_notes?.trim() || null,
      phone: data.phone?.trim()?.slice(0, 30) || null,
      recipient_name: data.recipient_name?.trim()?.slice(0, 150) || null,
      is_default: hasDefault === 0,
    },
  });
  await audit(req, { action: 'CREATE', resource: 'addresses', resource_id: address.id, new_values: { customer_id, city: city.name_fr, street_name: address.street_name } });
  return address;
}

async function listCities(search) {
  return prisma.city.findMany({
    where: {
      is_deleted: false,
      is_active: true,
      ...(search?.trim() ? { name_fr: { contains: search.trim(), mode: 'insensitive' } } : {}),
    },
    select: { id: true, name_fr: true, name_ar: true, postal_code: true },
    orderBy: { name_fr: 'asc' },
    take: 100,
  });
}

module.exports = {
  getMeta, getAvailableDates, calculate, findEligibleNodes, findPickupNodes,
  getDeliverySlots, createOrder, checkStock, expandCart,
  searchArticlesForNode, searchPacksForNode, getNodeSummary, getNodeSlots,
  createCustomer, createAddress, listCities,
  HOME_LIKE_CODES, PICKUP_LIKE_CODES, isHome, isPickup,
};
