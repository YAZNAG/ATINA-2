const prisma = require('../../config/database');
const {
  PACK_INCLUDE, computePackPrices, formatPack, getPackWithItems, skuPriceTtc,
  getCompositionLock, countActiveOrdersForPack, syncPackAvailability,
} = require('../pack/pack.shared');
const { notifyPackCreated } = require('../../utils/notify');
const { audit } = require('../../utils/audit');

/**
 * Back-office Packs / Bundles — WF #16 (créer), #22 (dupliquer), #23 (dispo temps réel),
 * US-071 (pack node-scoped), US-072 (composition + gel), US-073 (cycle de vie / suppression),
 * US-098..US-101 (assemblables, plafond, backorder, duplication).
 */

const err = (statusCode, message, details) => ({ statusCode, message, ...(details ? { details } : {}) });

function toIntOrNull(v, label, { min = 0 } = {}) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min) throw err(400, `${label} : entier ≥ ${min} attendu`);
  return n;
}

function toBool(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

function snapshot(p) {
  if (!p) return null;
  return {
    node_id: p.node_id, name_fr: p.name_fr, name_ar: p.name_ar,
    total_price: Number(p.total_price ?? 0), original_price: Number(p.original_price ?? 0),
    discount_pct: p.discount_pct != null ? Number(p.discount_pct) : null,
    valid_from: p.valid_from, valid_to: p.valid_to, is_active: p.is_active,
    max_pack_qty: p.max_pack_qty ?? null, sold_count: p.sold_count ?? 0,
    is_backorderable: p.is_backorderable, estimated_restock_days: p.estimated_restock_days,
    items: (p.pack_items ?? []).map(it => ({
      sku_id: it.sku_id, qty: Number(it.qty), unit_price_in_pack: Number(it.unit_price_in_pack), sort_order: it.sort_order,
    })),
  };
}

/** Normalise les lignes de composition reçues. */
function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw err(400, 'Le pack doit contenir au moins un composant (SKU)');
  }
  const seen = new Set();
  return items.map((it, i) => {
    if (!it || !it.sku_id) throw err(400, `Composant ${i + 1} : SKU requis`);
    if (seen.has(it.sku_id)) throw err(400, `Composant ${i + 1} : ce SKU est déjà présent dans la recette`);
    seen.add(it.sku_id);
    const qty = Number(it.qty ?? 1);
    if (!Number.isFinite(qty) || qty <= 0) throw err(400, `Composant ${i + 1} : la quantité doit être strictement supérieure à 0`);
    const rawPrice = it.unit_price_in_pack ?? it.unit_price;
    let unitPrice;
    if (rawPrice !== undefined && rawPrice !== null && rawPrice !== '') {
      unitPrice = Number(rawPrice);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw err(400, `Composant ${i + 1} : prix de contribution invalide`);
    }
    return {
      sku_id: it.sku_id,
      qty,
      unit_price_in_pack: unitPrice, // undefined ⇒ prix catalogue TTC par défaut
      sort_order: it.sort_order != null ? Number(it.sort_order) : i,
    };
  });
}

/**
 * Charge les SKU et vérifie qu'ils appartiennent au node du pack (US-072 : « un composant ne peut
 * être ajouté que s'il s'agit d'un SKU du même node que le pack » = SKU référencé sur ce node via
 * selling_rules ou stock_levels). `mustBelongIds` : SKU à contrôler strictement (les nouveaux).
 */
async function loadSkus(skuIds, nodeId, mustBelongIds = skuIds) {
  const skus = await prisma.sku.findMany({
    where:  { id: { in: skuIds } },
    select: {
      id: true, sku_code: true, name_fr: true, price: true, vat_rate: true, is_active: true, is_deleted: true,
      tax: { select: { rate: true } },
      selling_rules: { where: { node_id: nodeId }, select: { is_sellable: true } },
      stock_levels:  { where: { node_id: nodeId }, select: { qty_available: true } },
    },
  });
  const map = Object.fromEntries(skus.map(s => [s.id, s]));
  const missing = skuIds.filter(id => !map[id]);
  if (missing.length) throw err(400, `SKU introuvable(s) : ${missing.join(', ')}`);

  for (const id of mustBelongIds) {
    const s = map[id];
    if (s.is_deleted || !s.is_active) throw err(400, `Le SKU ${s.sku_code} est inactif ou supprimé : il ne peut pas être ajouté au pack`);
    if (!s.selling_rules.length && !s.stock_levels.length) {
      throw err(400, `Le SKU ${s.sku_code} n'est pas référencé sur le node du pack (ni règle de vente, ni stock) : un composant doit appartenir au même node que le pack`);
    }
  }
  return map;
}

async function assertNode(nodeId) {
  if (!nodeId) throw err(400, 'Node obligatoire : un pack est toujours rattaché à un seul node');
  const node = await prisma.node.findFirst({ where: { id: nodeId }, select: { id: true, is_deleted: true } }).catch(() => null);
  if (!node || node.is_deleted) throw err(400, 'Node introuvable');
  return node;
}

function periodWhere(period) {
  const now = new Date();
  switch (period) {
    case 'current':
      return {
        AND: [
          { OR: [{ valid_from: null }, { valid_from: { lte: now } }] },
          { OR: [{ valid_to: null }, { valid_to: { gte: now } }] },
        ],
      };
    case 'upcoming': return { valid_from: { gt: now } };
    case 'expired':  return { valid_to: { lt: now } };
    default: return null;
  }
}

// ─── Lecture ─────────────────────────────────────────────────────────────────

async function getAll(query = {}) {
  const where = { is_deleted: false };
  if (query.node_id) where.node_id = query.node_id;

  const status = query.status ?? query.is_active;
  if (status === 'active' || status === 'true' || status === true) where.is_active = true;
  else if (status === 'inactive' || status === 'false' || status === false) where.is_active = false;

  const pw = periodWhere(query.period);
  if (pw) Object.assign(where, pw);

  if (query.search) {
    const s = String(query.search).trim();
    where.OR = [
      { name_fr: { contains: s, mode: 'insensitive' } },
      { name_ar: { contains: s, mode: 'insensitive' } },
    ];
  }

  const all = query.all === 'true' || query.all === true;
  const page  = Math.max(1, parseInt(query.page  ?? '1', 10) || 1);
  const limit = all ? 1000 : Math.min(200, Math.max(1, parseInt(query.limit ?? '20', 10) || 20));
  const skip  = all ? 0 : (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.pack.findMany({ where, include: PACK_INCLUDE, orderBy: { created_at: 'desc' }, skip, take: limit }),
    prisma.pack.count({ where }),
  ]);

  let data = items.map(formatPack);
  if (query.availability === 'available')   data = data.filter(p => p.is_available);
  if (query.availability === 'unavailable') data = data.filter(p => !p.is_available);

  const pagination = { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
  return { data, pagination, meta: pagination };
}

async function getById(id) {
  const pack = await getPackWithItems(id);
  if (!pack) throw err(404, 'Pack introuvable');
  const lock = await getCompositionLock(id);
  return { ...formatPack(pack), composition_lock: lock };
}

async function getLock(id) {
  const pack = await prisma.pack.findFirst({ where: { id, is_deleted: false }, select: { id: true } });
  if (!pack) throw err(404, 'Pack introuvable');
  return getCompositionLock(id);
}

/**
 * SKU proposables comme composants d'un pack de ce node : SKU actifs, non supprimés, référencés
 * sur le node (règle de vente ou stock). Indique vendabilité et stock pour les warnings.
 */
async function eligibleSkus(query = {}) {
  const nodeId = query.node_id;
  if (!nodeId) throw err(400, 'Node obligatoire');
  const where = {
    is_deleted: false,
    is_active: true,
    OR: [
      { selling_rules: { some: { node_id: nodeId } } },
      { stock_levels:  { some: { node_id: nodeId } } },
    ],
  };
  if (query.search) {
    const s = String(query.search).trim();
    where.AND = [{
      OR: [
        { sku_code: { contains: s, mode: 'insensitive' } },
        { name_fr:  { contains: s, mode: 'insensitive' } },
        { name_ar:  { contains: s, mode: 'insensitive' } },
        { ean13:    { contains: s } },
      ],
    }];
  }
  const skus = await prisma.sku.findMany({
    where,
    take: Math.min(100, parseInt(query.limit ?? '30', 10) || 30),
    orderBy: { name_fr: 'asc' },
    select: {
      id: true, sku_code: true, name_fr: true, name_ar: true, price: true, vat_rate: true,
      tax: { select: { rate: true } },
      selling_rules: { where: { node_id: nodeId }, select: { is_sellable: true, is_backorderable: true } },
      stock_levels:  { where: { node_id: nodeId }, select: { qty_available: true } },
    },
  });
  return skus.map(s => ({
    id: s.id, sku_code: s.sku_code, name_fr: s.name_fr, name_ar: s.name_ar,
    price: skuPriceTtc(s),
    is_sellable: s.selling_rules[0]?.is_sellable ?? false,
    has_selling_rule: s.selling_rules.length > 0,
    qty_available: Math.max(0, Number(s.stock_levels[0]?.qty_available ?? 0)),
  }));
}

// ─── Création ────────────────────────────────────────────────────────────────

async function create(body, req) {
  const createdBy = req.user.id;
  const {
    node_id, name_fr, name_ar, description_fr, description_ar,
    discount_type, discount_value, total_price,
    valid_from, valid_to, items, image_url,
  } = body;

  await assertNode(node_id);
  if (!name_fr || !String(name_fr).trim()) throw err(400, 'Nom (FR) obligatoire');
  if (!name_ar || !String(name_ar).trim()) throw err(400, 'Nom (AR) obligatoire');
  if (valid_from && valid_to && new Date(valid_to) <= new Date(valid_from)) {
    throw err(400, 'La date de fin doit être postérieure à la date de début');
  }
  const noPrice = (total_price === undefined || total_price === null || total_price === '')
    && !(discount_type === 'percentage' && discount_value != null && discount_value !== '');
  if (noPrice) throw err(400, 'Prix pack obligatoire');

  const maxPackQty = toIntOrNull(body.max_pack_qty, 'Plafond de vente (max_pack_qty)') ?? null;
  const restock = toIntOrNull(body.estimated_restock_days, 'Délai de réappro (jours)', { min: 0 });
  const isBackorderable = toBool(body.is_backorderable);
  const isActive = body.is_active !== undefined ? toBool(body.is_active) : false; // créé inactif par défaut (WF #16 §14)

  const normItems = normalizeItems(items);
  const skuMap = await loadSkus(normItems.map(i => i.sku_id), node_id);
  normItems.forEach(it => {
    if (it.unit_price_in_pack === undefined) it.unit_price_in_pack = skuPriceTtc(skuMap[it.sku_id]);
  });

  const { originalPrice, finalPrice, discountPct } =
    computePackPrices(normItems, { discount_type, discount_value, total_price });
  if (finalPrice <= 0) throw err(400, 'Le prix pack doit être supérieur à 0');
  if (finalPrice > originalPrice) {
    throw err(400, `Le prix pack (${finalPrice} MAD) ne peut pas dépasser le prix original calculé (${originalPrice} MAD)`);
  }

  const created = await prisma.$transaction(async (tx) => {
    const pack = await tx.pack.create({
      data: {
        node_id,
        name_fr:        String(name_fr).trim(),
        name_ar:        String(name_ar).trim(),
        description_fr: description_fr || null,
        description_ar: description_ar || null,
        image_url:      image_url || null,
        total_price:    finalPrice,
        original_price: originalPrice,
        discount_pct:   discountPct,
        valid_from:     valid_from ? new Date(valid_from) : null,
        valid_to:       valid_to   ? new Date(valid_to)   : null,
        max_pack_qty:   maxPackQty,
        is_backorderable: isBackorderable,
        ...(restock != null ? { estimated_restock_days: restock } : {}),
        is_active:      isActive,
        sold_count:     0, // jamais saisissable : piloté par les commandes
        created_by:     createdBy,
        pack_items: {
          create: normItems.map((it, idx) => ({
            sku_id:             it.sku_id,
            qty:                it.qty,
            unit_price_in_pack: it.unit_price_in_pack,
            sort_order:         idx,
          })),
        },
      },
      include: PACK_INCLUDE,
    });
    await audit(req, { action: 'CREATE', resource: 'packs', resource_id: pack.id, new_values: snapshot(pack) }, tx);
    return pack;
  });

  await syncPackAvailability(created.id);
  const formatted = formatPack(await getPackWithItems(created.id));
  if (formatted.is_active) {
    notifyPackCreated(formatted.name_fr, formatted.total_price, formatted.discount_pct).catch(() => {});
  }
  return formatted;
}

// ─── Modification ────────────────────────────────────────────────────────────

async function update(id, body, req) {
  const existing = await getPackWithItems(id);
  if (!existing) throw err(404, 'Pack introuvable');

  if ('sold_count' in body) {
    throw err(400, 'Le compteur de packs vendus (sold_count) n\'est jamais modifiable : il est piloté par les commandes');
  }

  const data = {};

  // Node : obligatoire et immuable (un pack = un node ; utiliser « Dupliquer vers un node »).
  if (body.node_id !== undefined && body.node_id !== existing.node_id) {
    if (!body.node_id) throw err(400, 'Le node d\'un pack ne peut pas être vidé');
    if (existing.node_id) {
      throw err(400, 'Le node d\'un pack ne peut pas être changé : utilisez « Dupliquer vers un node »');
    }
    await assertNode(body.node_id);
    data.node_id = body.node_id; // rattrapage d'un pack historique sans node
  }
  const nodeId = data.node_id ?? existing.node_id;

  if (body.name_fr !== undefined) {
    if (!String(body.name_fr || '').trim()) throw err(400, 'Nom (FR) obligatoire');
    data.name_fr = String(body.name_fr).trim();
  }
  if (body.name_ar !== undefined) {
    if (!String(body.name_ar || '').trim()) throw err(400, 'Nom (AR) obligatoire');
    data.name_ar = String(body.name_ar).trim();
  }
  if (body.description_fr !== undefined) data.description_fr = body.description_fr || null;
  if (body.description_ar !== undefined) data.description_ar = body.description_ar || null;
  if (body.image_url      !== undefined) data.image_url      = body.image_url || null;
  if (body.valid_from     !== undefined) data.valid_from     = body.valid_from ? new Date(body.valid_from) : null;
  if (body.valid_to       !== undefined) data.valid_to       = body.valid_to   ? new Date(body.valid_to)   : null;
  const vf = data.valid_from !== undefined ? data.valid_from : existing.valid_from;
  const vt = data.valid_to   !== undefined ? data.valid_to   : existing.valid_to;
  if (vf && vt && new Date(vt) <= new Date(vf)) throw err(400, 'La date de fin doit être postérieure à la date de début');

  if (body.is_active        !== undefined) data.is_active        = toBool(body.is_active);
  if (body.is_backorderable !== undefined) data.is_backorderable = toBool(body.is_backorderable);
  const restock = toIntOrNull(body.estimated_restock_days, 'Délai de réappro (jours)', { min: 0 });
  if (restock !== undefined) data.estimated_restock_days = restock ?? 1;

  // Plafond de vente : jamais sous sold_count (US-099).
  const maxPackQty = toIntOrNull(body.max_pack_qty, 'Plafond de vente (max_pack_qty)');
  if (maxPackQty !== undefined) {
    const sold = Number(existing.sold_count ?? 0);
    if (maxPackQty !== null && maxPackQty < sold) {
      throw err(400, `Le plafond de vente ne peut pas être inférieur au nombre de packs déjà vendus (${sold}). Valeur minimale acceptée : ${sold}. Pour arrêter la vente, désactivez le pack.`);
    }
    data.max_pack_qty = maxPackQty;
  }

  // ── Composition ──
  const existingItems = existing.pack_items ?? [];
  const existingBySku = Object.fromEntries(existingItems.map(it => [it.sku_id, it]));
  let normItems = null;
  let recipeChanged = false;
  if (body.items !== undefined) {
    if (!nodeId) throw err(400, 'Rattachez d\'abord le pack à un node avant de modifier sa composition');
    normItems = normalizeItems(body.items);
    const newSkuIds = new Set(normItems.map(i => i.sku_id));
    const added   = normItems.filter(i => !existingBySku[i.sku_id]);
    const removed = existingItems.filter(it => !newSkuIds.has(it.sku_id));
    const qtyChanged = normItems.filter(i => existingBySku[i.sku_id] && Number(existingBySku[i.sku_id].qty) !== Number(i.qty));
    recipeChanged = added.length > 0 || removed.length > 0 || qtyChanged.length > 0;

    if (recipeChanged) {
      const lock = await getCompositionLock(id);
      if (lock.locked) {
        await audit(req, {
          action: 'UPDATE_REFUSED', resource: 'pack_items', resource_id: id,
          old_values: { items: snapshot(existing).items },
          new_values: { attempted_items: normItems, reasons: lock.reasons },
        });
        throw err(409,
          `Composition gelée : ${lock.reasons.map(r => r.message).join(' ')} Seuls les libellés, la description, l'image, les prix, la période, le plafond et l'activation restent modifiables. Pour changer la recette, désactivez ce pack et créez-en un nouveau.`,
          { composition_lock: lock });
      }
    }

    const skuMap = await loadSkus(normItems.map(i => i.sku_id), nodeId, added.map(i => i.sku_id));
    normItems.forEach(it => {
      if (it.unit_price_in_pack === undefined) {
        const prev = existingBySku[it.sku_id];
        it.unit_price_in_pack = prev ? Number(prev.unit_price_in_pack) : skuPriceTtc(skuMap[it.sku_id]);
      }
    });
  }

  // ── Prix ──
  const priceInputs = body.total_price !== undefined || body.discount_type !== undefined || body.discount_value !== undefined;
  if (normItems || priceInputs) {
    const calcItems = normItems ?? existingItems.map(it => ({ qty: Number(it.qty), unit_price_in_pack: Number(it.unit_price_in_pack) }));
    const { originalPrice, finalPrice, discountPct } = computePackPrices(calcItems, {
      discount_type:  body.discount_type,
      discount_value: body.discount_value,
      total_price:    body.total_price !== undefined ? body.total_price : Number(existing.total_price),
    });
    if (finalPrice <= 0) throw err(400, 'Le prix pack doit être supérieur à 0');
    if (finalPrice > originalPrice) {
      throw err(400, `Le prix pack (${finalPrice} MAD) ne peut pas dépasser le prix original calculé (${originalPrice} MAD)`);
    }
    data.original_price = originalPrice;
    data.total_price    = finalPrice;
    data.discount_pct   = discountPct;
  }

  // Activation : un pack actif doit avoir un node et au moins un composant.
  if (data.is_active === true && !existing.is_active) {
    if (!nodeId) throw err(400, 'Impossible d\'activer un pack sans node');
    const count = normItems ? normItems.length : existingItems.length;
    if (!count) throw err(400, 'Impossible d\'activer un pack sans composant');
  }

  await prisma.$transaction(async (tx) => {
    if (normItems) {
      const keep = new Set(normItems.map(i => i.sku_id));
      const toDelete = existingItems.filter(it => !keep.has(it.sku_id)).map(it => it.id);
      if (toDelete.length) await tx.packItem.deleteMany({ where: { id: { in: toDelete } } });
      for (const [idx, it] of normItems.entries()) {
        const prev = existingBySku[it.sku_id];
        if (prev) {
          if (Number(prev.qty) !== it.qty || Number(prev.unit_price_in_pack) !== it.unit_price_in_pack || prev.sort_order !== idx) {
            await tx.packItem.update({
              where: { id: prev.id },
              data:  { qty: it.qty, unit_price_in_pack: it.unit_price_in_pack, sort_order: idx },
            });
          }
        } else {
          await tx.packItem.create({
            data: { pack_id: id, sku_id: it.sku_id, qty: it.qty, unit_price_in_pack: it.unit_price_in_pack, sort_order: idx },
          });
        }
      }
    }
    if (Object.keys(data).length) await tx.pack.update({ where: { id }, data });

    const after = await getPackWithItems(id, tx);
    await audit(req, {
      action: recipeChanged ? 'UPDATE_COMPOSITION' : (Object.keys(data).length === 1 && 'is_active' in data ? (data.is_active ? 'ACTIVATE' : 'DEACTIVATE') : 'UPDATE'),
      resource: 'packs', resource_id: id,
      old_values: snapshot(existing), new_values: snapshot(after),
    }, tx);
  });

  await syncPackAvailability(id);
  const formatted = formatPack(await getPackWithItems(id));
  if (data.is_active === true && !existing.is_active) {
    notifyPackCreated(formatted.name_fr, formatted.total_price, formatted.discount_pct).catch(() => {});
  }
  return { ...formatted, composition_lock: await getCompositionLock(id) };
}

async function setActive(id, isActive, req) {
  return update(id, { is_active: !!isActive }, req);
}

// ─── Suppression (soft-delete) ───────────────────────────────────────────────

async function remove(id, req) {
  const existing = await prisma.pack.findFirst({ where: { id, is_deleted: false } });
  if (!existing) throw err(404, 'Pack introuvable');

  const activeOrders = await countActiveOrdersForPack(id);
  if (activeOrders > 0) {
    await audit(req, {
      action: 'DELETE_REFUSED', resource: 'packs', resource_id: id,
      old_values: { is_active: existing.is_active },
      new_values: { reason: 'ACTIVE_ORDERS', active_orders_count: activeOrders },
    });
    throw err(409,
      `Suppression refusée : ${activeOrders} commande(s) active(s) utilisent ce pack. Vous pouvez le désactiver à la place : il quittera immédiatement le catalogue client et les commandes en cours se termineront normalement.`,
      { active_orders_count: activeOrders, can_deactivate: existing.is_active, orders_link: `/orders-mgmt?pack_id=${id}` });
  }

  await prisma.$transaction(async (tx) => {
    await tx.pack.update({
      where: { id },
      data:  { is_deleted: true, deleted_at: new Date(), is_active: false },
    });
    await audit(req, {
      action: 'DELETE', resource: 'packs', resource_id: id,
      old_values: { is_deleted: false, is_active: existing.is_active },
      new_values: { is_deleted: true, is_active: false },
    }, tx);
  });
  return { id };
}

// ─── Duplication vers un autre node (WF #22, US-101) ─────────────────────────

async function duplicateToNode(id, targetNodeId, req) {
  await assertNode(targetNodeId);
  const source = await getPackWithItems(id);
  if (!source) throw err(404, 'Pack introuvable');
  if (source.node_id === targetNodeId) throw err(400, 'Le node cible doit être différent du node source');

  const skuIds = source.pack_items.map(it => it.sku_id);
  const skus = await prisma.sku.findMany({
    where:  { id: { in: skuIds } },
    select: {
      id: true, sku_code: true, name_fr: true, is_active: true, is_deleted: true,
      selling_rules: { where: { node_id: targetNodeId }, select: { is_sellable: true } },
      stock_levels:  { where: { node_id: targetNodeId }, select: { qty_available: true } },
    },
  });
  const skuMap = Object.fromEntries(skus.map(s => [s.id, s]));
  const warnings = [];
  for (const it of source.pack_items) {
    const s = skuMap[it.sku_id];
    let reason = null;
    if (!s || s.is_deleted || !s.is_active) reason = 'SKU inactif ou supprimé';
    else if (!s.selling_rules.length && !s.stock_levels.length) reason = 'SKU absent du node cible';
    else if (s.selling_rules.length && !s.selling_rules[0].is_sellable) reason = 'SKU non vendable sur le node cible';
    else if (Math.max(0, Number(s.stock_levels[0]?.qty_available ?? 0)) < Number(it.qty)) reason = 'Stock insuffisant sur le node cible';
    if (reason) warnings.push({ sku_id: it.sku_id, sku_code: s?.sku_code ?? it.sku?.sku_code, name_fr: s?.name_fr ?? it.sku?.name_fr, reason });
  }

  const created = await prisma.$transaction(async (tx) => {
    const pack = await tx.pack.create({
      data: {
        node_id:        targetNodeId,
        name_fr:        source.name_fr,
        name_ar:        source.name_ar,
        description_fr: source.description_fr,
        description_ar: source.description_ar,
        image_url:      source.image_url,
        // Prix copiés TELS QUELS (WF #22 §4)
        total_price:    source.total_price,
        original_price: source.original_price,
        discount_pct:   source.discount_pct,
        valid_from:     source.valid_from,
        valid_to:       source.valid_to,
        // Règles de vente propres au node cible : à renseigner par l'admin (WF #22 §7)
        max_pack_qty:     null,
        is_backorderable: false,
        is_active:        false, // jamais actif automatiquement
        sold_count:       0,
        created_by:       req.user.id,
        pack_items: {
          create: source.pack_items.map((it, idx) => ({
            sku_id:             it.sku_id,
            qty:                it.qty,
            unit_price_in_pack: it.unit_price_in_pack,
            sort_order:         it.sort_order ?? idx,
          })),
        },
      },
    });
    await audit(req, {
      action: 'DUPLICATE', resource: 'packs', resource_id: pack.id,
      old_values: { source_pack_id: id, source_node_id: source.node_id },
      new_values: { node_id: targetNodeId, is_active: false, warnings },
    }, tx);
    return pack;
  });

  await syncPackAvailability(created.id);
  const pack = formatPack(await getPackWithItems(created.id));
  return { pack, warnings };
}

module.exports = {
  getAll, getById, getLock, eligibleSkus, create, update, setActive, remove, duplicateToNode,
};
