const prisma = require('../../config/database');

/**
 * Fonctions partagées « Packs » (back-office, app cliente, commandes, flash sales).
 *
 * Règles (classeur Atina — WF #16/#22/#23, US-071..073, US-098..102, FAQ Packs) :
 *  - un pack est rattaché à UN node (node_id obligatoire) ;
 *  - packs_assemblables = MIN sur les composants de FLOOR(stock_levels.qty_available / pack_items.qty),
 *    calculé à la volée sur le node du pack, jamais stocké, sans réservation ;
 *  - plafond_restant = max_pack_qty − sold_count (illimité si max_pack_qty est NULL) ;
 *  - quantité vendable = MIN(assemblables, plafond_restant) ; si is_backorderable = TRUE,
 *    le stock ne limite plus (override total des règles SKU) mais le plafond reste bloquant ;
 *  - is_available = (is_backorderable OU assemblables ≥ 1) ET (max_pack_qty NULL OU sold_count < max_pack_qty).
 */

const PACK_INCLUDE = {
  node: { select: { id: true, code: true, name_fr: true, name_ar: true } },
  pack_items: {
    include: {
      sku: {
        select: {
          id: true,
          name_fr: true, name_ar: true, sku_code: true, price: true,
          unit_sale: true, vat_rate: true,
          category_id: true,
          is_active: true, is_deleted: true,
          tax: { select: { rate: true } },
          images: {
            where:  { is_primary: true },
            select: { url: true },
            take: 1,
          },
          stock_levels: {
            select: { node_id: true, qty_available: true },
          },
          selling_rules: {
            select: { node_id: true, is_backorderable: true, is_sellable: true, price: true },
          },
        },
      },
    },
    orderBy: { sort_order: 'asc' },
  },
};

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/** Prix TTC catalogue d'un SKU (sku.price est HT). Sert de prix de contribution par défaut. */
function skuPriceTtc(sku) {
  const priceHt = Number(sku?.price ?? 0);
  const vatRate = Number(sku?.tax?.rate ?? sku?.vat_rate ?? 20);
  return round2(priceHt * (1 + vatRate / 100));
}

/**
 * Prix du pack (WF #16 étapes 8-9) :
 *   prix original = SOMME(unit_price_in_pack × qty)   (unit_price_in_pack = prix de contribution en MAD)
 *   remise %      = (1 − prix pack / prix original) × 100
 * Options : total_price (prix pack saisi) ou discount_type = 'percentage' + discount_value.
 */
function computePackPrices(packItems, { discount_type, discount_value, total_price } = {}) {
  const originalPrice = round2(packItems.reduce(
    (sum, it) => sum + Number(it.unit_price_in_pack ?? 0) * Number(it.qty ?? 1), 0,
  ));

  let finalPrice;
  if (discount_type === 'percentage' && (discount_value !== undefined && discount_value !== null && discount_value !== '')) {
    const val = Number(discount_value);
    if (!Number.isFinite(val) || val < 0 || val > 100) throw { statusCode: 400, message: 'Pourcentage de remise invalide (0 à 100)' };
    finalPrice = originalPrice * (1 - val / 100);
  } else if (total_price !== undefined && total_price !== null && total_price !== '') {
    finalPrice = Number(total_price);
  } else {
    finalPrice = originalPrice;
  }
  if (!Number.isFinite(finalPrice)) throw { statusCode: 400, message: 'Prix pack invalide' };
  finalPrice = round2(finalPrice);

  const discountPct = originalPrice > 0 ? round2((1 - finalPrice / originalPrice) * 100) : 0;
  return { originalPrice, finalPrice, discountPct };
}

function resolveImageUrl(imagePath) {
  if (!imagePath) return null;
  if (/^https?:\/\//.test(imagePath)) return imagePath;
  const base = process.env.BASE_URL;
  if (!base) return imagePath;
  return `${base}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
}

/** Situation d'un composant sur le node du pack. */
function resolveComponentAvailability(sku, packNodeId) {
  const stock = (sku?.stock_levels ?? []).find(s => s.node_id === packNodeId);
  const rule  = (sku?.selling_rules ?? []).find(r => r.node_id === packNodeId);
  return {
    qtyAvailable:   Math.max(0, Number(stock?.qty_available ?? 0)),
    hasStockLevel:  !!stock,
    hasSellingRule: !!rule,
    isSellable:     rule ? !!rule.is_sellable : false,
    isBackorderable: rule?.is_backorderable ?? false,
  };
}

/**
 * Disponibilité read-time d'un pack (source de vérité quantitative, jamais stockée).
 * @returns {{ assemblableCount:number, remainingCap:number|null, vendableCount:number|null, isAvailable:boolean }}
 *   remainingCap / vendableCount = null ⇒ illimité.
 */
function computePackAvailability(pack) {
  const items = pack.pack_items ?? [];
  let assemblableCount = 0;
  if (items.length && pack.node_id) {
    assemblableCount = Infinity;
    for (const it of items) {
      const { qtyAvailable } = resolveComponentAvailability(it.sku, pack.node_id);
      const qty = Number(it.qty ?? 1);
      const n = qty > 0 ? Math.floor(qtyAvailable / qty) : 0;
      assemblableCount = Math.min(assemblableCount, n);
    }
    assemblableCount = Number.isFinite(assemblableCount) ? Math.max(0, assemblableCount) : 0;
  }

  const soldCount = Number(pack.sold_count ?? 0);
  const maxQty = pack.max_pack_qty != null ? Number(pack.max_pack_qty) : null;
  const remainingCap = maxQty != null ? Math.max(0, maxQty - soldCount) : null;
  const backorderable = !!pack.is_backorderable;

  let vendableCount;
  if (backorderable) vendableCount = remainingCap; // le stock ne limite plus, le plafond oui
  else vendableCount = remainingCap != null ? Math.min(assemblableCount, remainingCap) : assemblableCount;

  const isAvailable = (backorderable || assemblableCount >= 1) && (maxQty == null || soldCount < maxQty);
  return { assemblableCount, remainingCap, vendableCount, isAvailable };
}

function componentStatus(sku, avail, qty) {
  if (!sku || sku.is_deleted || sku.is_active === false) return { code: 'inactif', label: 'SKU inactif ou supprimé' };
  if (!avail.hasSellingRule && !avail.hasStockLevel) return { code: 'absent', label: 'SKU absent de ce node' };
  if (avail.hasSellingRule && !avail.isSellable) return { code: 'non_vendable', label: 'Non vendable sur ce node' };
  if (avail.qtyAvailable < qty) return { code: 'rupture', label: 'Stock insuffisant' };
  return { code: 'ok', label: 'Disponible' };
}

function formatPack(pack) {
  const items = (pack.pack_items ?? []).map(it => {
    const qty = Number(it.qty ?? 1);
    const unitPrice = Number(it.unit_price_in_pack ?? 0);
    const avail = resolveComponentAvailability(it.sku, pack.node_id);
    const status = componentStatus(it.sku, avail, qty);
    return {
      id:              it.id,
      sku_id:          it.sku_id,
      name_fr:         it.sku?.name_fr,
      name_ar:         it.sku?.name_ar,
      sku_code:        it.sku?.sku_code,
      qty,
      sort_order:      it.sort_order ?? 0,
      unit_price:      unitPrice,           // prix de contribution dans le pack (MAD)
      unit_price_in_pack: unitPrice,
      catalog_price:   skuPriceTtc(it.sku), // prix catalogue TTC du SKU, pour information
      line_total:      round2(unitPrice * qty),
      unit_label:      it.sku?.unit_sale ?? null,
      image_url:       resolveImageUrl(it.sku?.images?.[0]?.url),
      stock_available: avail.qtyAvailable,
      assemblable:     qty > 0 ? Math.floor(avail.qtyAvailable / qty) : 0,
      is_sellable:     avail.isSellable,
      component_status: status.code,
      component_status_label: status.label,
    };
  });

  const { assemblableCount, remainingCap, vendableCount, isAvailable } = computePackAvailability(pack);

  return {
    id:             pack.id,
    node_id:        pack.node_id,
    node:           pack.node ?? null,
    name_fr:        pack.name_fr,
    name_ar:        pack.name_ar,
    description_fr: pack.description_fr,
    description_ar: pack.description_ar,
    image_url:      resolveImageUrl(pack.image_url),
    original_price: Number(pack.original_price ?? 0),
    total_price:    Number(pack.total_price ?? 0),
    discount_pct:   pack.discount_pct != null ? Number(pack.discount_pct) : 0,
    saved_amount:   round2(Number(pack.original_price ?? 0) - Number(pack.total_price ?? 0)),
    valid_from:     pack.valid_from,
    valid_to:       pack.valid_to,
    is_active:      pack.is_active,
    max_pack_qty:   pack.max_pack_qty ?? null,
    sold_count:     Number(pack.sold_count ?? 0),
    remaining_cap:  remainingCap,
    is_backorderable:       !!pack.is_backorderable,
    estimated_restock_days: pack.estimated_restock_days ?? 1,
    assemblable_count:      assemblableCount,  // calcul à la volée
    vendable_count:         vendableCount,     // null = illimité
    is_available:           isAvailable,       // valeur read-time (même formule que le trigger)
    is_available_flag:      pack.is_available ?? null,          // flag matérialisé par le trigger
    availability_updated_at: pack.availability_updated_at ?? null,
    unavailable_components: items.filter(i => i.component_status !== 'ok').length,
    created_at:     pack.created_at,
    updated_at:     pack.updated_at,
    items,
    item_count:     items.length,
  };
}

function buildImagePayload(pack, formattedItems) {
  return {
    id:             pack.id,
    name_fr:        pack.name_fr,
    original_price: Number(pack.original_price ?? 0),
    total_price:    Number(pack.total_price ?? 0),
    discount_pct:   pack.discount_pct != null ? Number(pack.discount_pct) : 0,
    items:          formattedItems,
  };
}

async function getPackWithItems(packId, db = prisma) {
  return db.pack.findFirst({
    where:   { id: packId, is_deleted: false },
    include: PACK_INCLUDE,
  });
}

// ─── Garde-fous commandes / ventes flash ─────────────────────────────────────

/** Nombre de commandes ACTIVES (statut non terminal) contenant ce pack (US-072 / US-073). */
async function countActiveOrdersForPack(packId, db = prisma) {
  return db.order.count({
    where: {
      is_deleted: false,
      status: { is_terminal: false },
      items: { some: { pack_id: packId } },
    },
  });
}

/**
 * Composition gelée ? (US-072) — condition 1 : commande active contenant le pack ;
 * condition 2 : vente flash active, non supprimée, non terminée (en cours ou programmée) ciblant le pack.
 */
async function getCompositionLock(packId, db = prisma) {
  const now = new Date();
  const [activeOrdersCount, flashSales] = await Promise.all([
    countActiveOrdersForPack(packId, db),
    db.flashSale.findMany({
      where:   { pack_id: packId, is_active: true, is_deleted: false, ends_at: { gte: now } },
      select:  { id: true, name_fr: true, starts_at: true, ends_at: true },
      orderBy: { starts_at: 'asc' },
    }),
  ]);

  const reasons = [];
  if (activeOrdersCount > 0) {
    reasons.push({
      code: 'ACTIVE_ORDERS',
      count: activeOrdersCount,
      message: `${activeOrdersCount} commande(s) active(s) contiennent ce pack : le préparateur prépare une recette figée.`,
      link: `/orders-mgmt?pack_id=${packId}`,
    });
  }
  for (const fs of flashSales) {
    const state = new Date(fs.starts_at) <= now ? 'en cours' : 'programmée';
    reasons.push({
      code: 'FLASH_SALE',
      flash_sale_id: fs.id,
      name: fs.name_fr || 'Vente flash',
      state,
      message: `La vente flash « ${fs.name_fr || fs.id} » (${state}) cible ce pack : son plafond a été validé sur la composition actuelle.`,
      link: `/offres/flash-sales?id=${fs.id}`,
    });
  }

  return {
    locked: reasons.length > 0,
    active_orders_count: activeOrdersCount,
    flash_sales: flashSales.map(fs => ({ ...fs, state: new Date(fs.starts_at) <= now ? 'en_cours' : 'programmee' })),
    reasons,
  };
}

/**
 * Infos de vente d'un pack (pour commandes et ventes flash) :
 * { pack_id, node_id, is_active, is_backorderable, assemblable_count, max_pack_qty, sold_count,
 *   remaining_cap (null = illimité), vendable_count (null = illimité), is_available }
 */
async function getPackSellableInfo(packId, db = prisma) {
  const pack = await getPackWithItems(packId, db);
  if (!pack) throw { statusCode: 404, message: 'Pack introuvable' };
  const a = computePackAvailability(pack);
  return {
    pack_id: pack.id,
    node_id: pack.node_id,
    is_active: pack.is_active,
    is_backorderable: !!pack.is_backorderable,
    estimated_restock_days: pack.estimated_restock_days ?? 1,
    max_pack_qty: pack.max_pack_qty ?? null,
    sold_count: Number(pack.sold_count ?? 0),
    assemblable_count: a.assemblableCount,
    remaining_cap: a.remainingCap,
    vendable_count: a.vendableCount,
    is_available: a.isAvailable,
  };
}

/**
 * Ajuste le compteur cumulé packs.sold_count (WF #16 étape 11, US-099, US-110).
 * À appeler DANS la transaction de la commande :
 *   - validation d'une commande contenant le pack  → adjustPackSoldCount(packId, +qty, tx)
 *   - annulation de cette commande                  → adjustPackSoldCount(packId, -qty, tx)
 * L'incrément est atomique et refusé (409) s'il dépasse max_pack_qty − sold_count.
 * Le décrément ne descend jamais sous 0. Le trigger PG recalcule ensuite is_available.
 * @returns {Promise<{ sold_count:number, max_pack_qty:number|null }>}
 */
async function adjustPackSoldCount(packId, delta, db = prisma) {
  const d = Math.trunc(Number(delta));
  if (!packId || !Number.isFinite(d) || d === 0) throw { statusCode: 400, message: 'Ajustement de sold_count invalide' };

  let rows;
  if (d > 0) {
    rows = await db.$queryRaw`
      UPDATE packs SET sold_count = sold_count + ${d}::int, updated_at = now()
       WHERE id = ${packId}::uuid
         AND (max_pack_qty IS NULL OR sold_count + ${d}::int <= max_pack_qty)
      RETURNING sold_count, max_pack_qty`;
    if (!rows.length) {
      const p = await db.pack.findUnique({ where: { id: packId }, select: { sold_count: true, max_pack_qty: true } });
      if (!p) throw { statusCode: 404, message: 'Pack introuvable' };
      const left = Math.max(0, Number(p.max_pack_qty ?? 0) - Number(p.sold_count ?? 0));
      throw { statusCode: 409, message: `Plafond de vente du pack atteint : il reste ${left} pack(s) vendable(s).` };
    }
  } else {
    rows = await db.$queryRaw`
      UPDATE packs SET sold_count = GREATEST(sold_count + ${d}::int, 0), updated_at = now()
       WHERE id = ${packId}::uuid
      RETURNING sold_count, max_pack_qty`;
    if (!rows.length) throw { statusCode: 404, message: 'Pack introuvable' };
  }
  return { sold_count: Number(rows[0].sold_count), max_pack_qty: rows[0].max_pack_qty ?? null };
}

// ─── Flag is_available (repli si le trigger PG n'est pas installé) ───────────

let _triggerInstalled = null;
async function isAvailabilityTriggerInstalled(db = prisma) {
  if (_triggerInstalled !== null) return _triggerInstalled;
  try {
    const rows = await db.$queryRaw`SELECT 1 AS ok FROM pg_proc WHERE proname = 'pack_recompute_availability' LIMIT 1`;
    _triggerInstalled = rows.length > 0;
  } catch {
    _triggerInstalled = false;
  }
  return _triggerInstalled;
}

/**
 * Garantit que packs.is_available / availability_updated_at reflètent la formule.
 * Si la migration trigger est installée, le trigger s'en charge déjà : no-op.
 * Sinon, recalcul applicatif (repli) — sans NOTIFY.
 */
async function syncPackAvailability(packId, db = prisma) {
  if (await isAvailabilityTriggerInstalled(db)) return;
  const pack = await getPackWithItems(packId, db);
  if (!pack) return;
  const { isAvailable } = computePackAvailability(pack);
  await db.pack.update({
    where: { id: packId },
    data:  { is_available: isAvailable, availability_updated_at: new Date() },
  });
}

module.exports = {
  PACK_INCLUDE, computePackPrices, computePackAvailability, formatPack,
  buildImagePayload, getPackWithItems, resolveImageUrl, skuPriceTtc,
  countActiveOrdersForPack, getCompositionLock, getPackSellableInfo,
  adjustPackSoldCount, syncPackAvailability,
};
