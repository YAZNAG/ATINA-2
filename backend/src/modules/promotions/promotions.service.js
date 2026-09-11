const prisma = require('../../config/database');
const { audit } = require('../../utils/audit');
const {
  FLASH_INCLUDE, validateDiscount, formatPromo, flashStatusOf, referencePriceOf, round2,
} = require('../flash_sale/flash_sale.shared');
const { computeCeiling, evaluateStockFlash } = require('../flash_sale/flash_sale.rules');
const { notifyFlashSaleCreated } = require('../../utils/notify');

/*
 * Table flash_sales :
 *  - cible SKU ou PACK  → « Ventes flash » (écran Offres > Flash Sales) : règles WF #1, #18, #33, US-074/075/111 ;
 *  - cible catégorie / marque → « Autres promotions » (écran Offres > Promotions), comportement historique conservé.
 */

const RESOURCE = 'flash_sales';
const TERMINAL_CODES = ['delivered', 'cancelled', 'returned'];
const FLASH_STATUSES = ['programmee', 'en_cours', 'epuisee', 'terminee', 'desactivee'];

const isBlank = (v) => v === undefined || v === null || v === '' || v === 'null' || v === 'undefined';
const has = (body, k) => Object.prototype.hasOwnProperty.call(body ?? {}, k);

function parseBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return ['true', '1', 'on', 'yes', 'oui'].includes(v.trim().toLowerCase());
  return !!v;
}

function parseDate(v, label) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw { statusCode: 400, message: `${label} invalide` };
  return d;
}

function snapshot(fs) {
  if (!fs) return null;
  return {
    node_id: fs.node_id, sku_id: fs.sku_id, pack_id: fs.pack_id, category_id: fs.category_id, brand_id: fs.brand_id,
    name_fr: fs.name_fr, name_ar: fs.name_ar, image_url: fs.image_url,
    flash_price: fs.flash_price != null ? Number(fs.flash_price) : null,
    discount_type: fs.discount_type, discount_value: fs.discount_value != null ? Number(fs.discount_value) : null,
    stock_flash: fs.stock_flash, sold_count: fs.sold_count, max_qty_per_user: fs.max_qty_per_user,
    starts_at: fs.starts_at, ends_at: fs.ends_at, is_active: fs.is_active, is_deleted: fs.is_deleted,
  };
}

async function refuse(req, id, action, message, extra = {}) {
  if (id) await audit(req, { action, resource: RESOURCE, resource_id: id, new_values: { reason: message, ...extra } });
  throw { statusCode: 400, message };
}

async function deactivateExpired() {
  await prisma.flashSale.updateMany({
    where: { is_active: true, is_deleted: false, ends_at: { lt: new Date() } },
    data: { is_active: false },
  });
}

// ————————————————————————————————————————— Lecture

function buildWhere(query = {}) {
  const and = [];
  const status = query.status;

  if (status === 'deleted' || status === 'supprimee' || query.flash_status === 'supprimee') and.push({ is_deleted: true });
  else {
    and.push({ is_deleted: false });
    if (status === 'active')   and.push({ is_active: true });
    if (status === 'inactive') and.push({ is_active: false });
  }

  if (query.node_id) and.push({ node_id: String(query.node_id) });

  const scope = query.scope_type ?? query.target;
  if (scope === 'sku')      and.push({ sku_id: { not: null } });
  if (scope === 'pack')     and.push({ pack_id: { not: null } });
  if (scope === 'category') and.push({ category_id: { not: null } });
  if (scope === 'brand')    and.push({ brand_id: { not: null } });
  if (scope === 'flash')    and.push({ OR: [{ sku_id: { not: null } }, { pack_id: { not: null } }] });
  if (scope === 'other')    and.push({ OR: [{ category_id: { not: null } }, { brand_id: { not: null } }] });

  // Période : ventes dont la fenêtre chevauche [date_from ; date_to]
  if (query.date_from) {
    const d = new Date(query.date_from);
    if (!Number.isNaN(d.getTime())) and.push({ ends_at: { gte: d } });
  }
  if (query.date_to) {
    const d = new Date(query.date_to);
    if (!Number.isNaN(d.getTime())) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(query.date_to))) d.setHours(23, 59, 59, 999);
      and.push({ starts_at: { lte: d } });
    }
  }

  if (query.search) {
    const s = String(query.search);
    and.push({
      OR: [
        { name_fr: { contains: s, mode: 'insensitive' } },
        { name_ar: { contains: s, mode: 'insensitive' } },
        { sku: { name_fr: { contains: s, mode: 'insensitive' } } },
        { sku: { sku_code: { contains: s, mode: 'insensitive' } } },
        { pack: { name_fr: { contains: s, mode: 'insensitive' } } },
      ],
    });
  }
  return { AND: and };
}

async function getAll(query = {}) {
  await deactivateExpired();

  const where = buildWhere(query);
  const page  = Math.max(1, parseInt(query.page  ?? '1', 10) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(query.limit ?? '20', 10) || 20));
  const skip  = (page - 1) * limit;
  const flashStatus = query.flash_status && query.flash_status !== 'supprimee' ? String(query.flash_status) : null;

  if (flashStatus) {
    if (!FLASH_STATUSES.includes(flashStatus)) throw { statusCode: 400, message: 'Statut inconnu' };
    // « Terminée » englobe la fin de fenêtre ET l'arrêt volontaire (US-075).
    const accept = flashStatus === 'terminee' ? ['terminee', 'desactivee'] : [flashStatus];
    const rows = await prisma.flashSale.findMany({ where, include: FLASH_INCLUDE, orderBy: { created_at: 'desc' }, take: 5000 });
    const now = new Date();
    const filtered = rows.filter((r) => accept.includes(flashStatusOf(r, now)));
    const total = filtered.length;
    const pagination = { total, page, limit, pages: Math.ceil(total / limit) };
    return { data: filtered.slice(skip, skip + limit).map(formatPromo), pagination, meta: pagination };
  }

  const [items, total] = await Promise.all([
    prisma.flashSale.findMany({ where, include: FLASH_INCLUDE, orderBy: { created_at: 'desc' }, skip, take: limit }),
    prisma.flashSale.count({ where }),
  ]);
  const pagination = { total, page, limit, pages: Math.ceil(total / limit) };
  return { data: items.map(formatPromo), pagination, meta: pagination };
}

async function getById(id) {
  await deactivateExpired();
  const fs = await prisma.flashSale.findFirst({ where: { id }, include: FLASH_INCLUDE });
  if (!fs) throw { statusCode: 404, message: 'Vente flash introuvable' };
  const formatted = formatPromo(fs);

  if (!fs.sku_id && !fs.pack_id) return formatted;

  // WF #18 étape 20 : plafond recalculé à chaque ouverture, avertissement si dépassé.
  let ceiling = null;
  let evaluation = { errors: [], warnings: [] };
  try {
    ceiling = await computeCeiling({ node_id: fs.node_id, sku_id: fs.sku_id, pack_id: fs.pack_id });
    evaluation = evaluateStockFlash(ceiling, fs.stock_flash ?? 0, { soldCount: fs.sold_count, changed: false });
  } catch (e) {
    evaluation.warnings.push(e.message || 'Plafond non calculable');
  }
  const activeOrders = await countActiveOrderLines(id);
  return {
    ...formatted,
    ceiling,
    min_allowed: evaluation.min_allowed ?? Math.max(1, fs.sold_count),
    max_allowed: evaluation.max_allowed ?? null,
    warnings: [...evaluation.errors, ...evaluation.warnings],
    active_orders_count: activeOrders,
  };
}

async function getFlashLookups(query = {}) {
  const nodes = await prisma.node.findMany({
    where: { is_deleted: false },
    select: { id: true, code: true, name_fr: true, is_active: true },
    orderBy: { name_fr: 'asc' },
  });
  const out = { nodes, skus: [], packs: [] };
  const nodeId = query.node_id ? String(query.node_id) : null;
  if (!nodeId) return out;
  const search = String(query.search ?? '').trim();

  if (!query.target || query.target === 'sku') {
    const where = {
      is_deleted: false,
      OR: [{ selling_rules: { some: { node_id: nodeId } } }, { stock_levels: { some: { node_id: nodeId } } }],
    };
    if (search) {
      where.AND = [{ OR: [
        { name_fr: { contains: search, mode: 'insensitive' } },
        { sku_code: { contains: search, mode: 'insensitive' } },
        { ean13: { contains: search } },
      ] }];
    }
    const skus = await prisma.sku.findMany({
      where,
      select: {
        id: true, sku_code: true, name_fr: true, name_ar: true, price: true, vat_rate: true, is_active: true,
        tax: { select: { rate: true } },
        selling_rules: { where: { node_id: nodeId }, select: { node_id: true, price: true, is_sellable: true, is_backorderable: true } },
        stock_levels: { where: { node_id: nodeId }, select: { qty_available: true } },
      },
      orderBy: { name_fr: 'asc' },
      take: 30,
    });
    out.skus = skus.map((s) => ({
      id: s.id,
      sku_code: s.sku_code,
      name_fr: s.name_fr,
      name_ar: s.name_ar,
      is_active: s.is_active,
      reference_price: referencePriceOf({ node_id: nodeId, sku: s }),
      qty_available: Math.max(0, Math.floor(Number(s.stock_levels?.[0]?.qty_available ?? 0))),
      is_sellable: s.selling_rules?.[0]?.is_sellable ?? null,
      is_backorderable: s.selling_rules?.[0]?.is_backorderable ?? false,
    }));
  }

  if (!query.target || query.target === 'pack') {
    const packs = await prisma.pack.findMany({
      where: {
        node_id: nodeId, is_deleted: false,
        ...(search && { name_fr: { contains: search, mode: 'insensitive' } }),
      },
      select: { id: true, name_fr: true, name_ar: true, total_price: true, is_active: true, is_backorderable: true, max_pack_qty: true },
      orderBy: { name_fr: 'asc' },
      take: 50,
    });
    out.packs = packs.map((p) => ({ ...p, reference_price: round2(p.total_price), total_price: round2(p.total_price) }));
  }
  return out;
}

/** Plafond flash (prévisualisation dans le formulaire). */
async function getCeiling(query = {}) {
  let soldCount = 0;
  let changed = true;
  let creation = true;
  let nodeId = query.node_id;
  let skuId = query.sku_id;
  let packId = query.pack_id;
  let existing = null;

  if (query.id) {
    existing = await prisma.flashSale.findFirst({ where: { id: String(query.id) } });
    if (!existing) throw { statusCode: 404, message: 'Vente flash introuvable' };
    nodeId = existing.node_id; skuId = existing.sku_id; packId = existing.pack_id;
    soldCount = existing.sold_count;
    creation = false;
  }
  const ceiling = await computeCeiling({ node_id: nodeId, sku_id: skuId || null, pack_id: packId || null });
  const stockFlash = isBlank(query.stock_flash) ? null : Number(query.stock_flash);
  if (existing && stockFlash != null) changed = stockFlash !== existing.stock_flash;

  const evaluation = stockFlash != null
    ? evaluateStockFlash(ceiling, stockFlash, { soldCount, changed, creation })
    : { errors: creation && ceiling.creation_refused ? [ceiling.refusal_reason] : [], warnings: [], min_allowed: Math.max(1, soldCount), max_allowed: ceiling.max_new == null ? null : soldCount + ceiling.max_new };

  let referencePrice = null;
  if (skuId) {
    const sku = await prisma.sku.findUnique({
      where: { id: String(skuId) },
      select: { price: true, vat_rate: true, tax: { select: { rate: true } }, selling_rules: { where: { node_id: String(nodeId) }, select: { node_id: true, price: true } } },
    });
    referencePrice = sku ? referencePriceOf({ node_id: String(nodeId), sku }) : null;
  } else if (packId) {
    const pack = await prisma.pack.findUnique({ where: { id: String(packId) }, select: { total_price: true } });
    referencePrice = pack ? round2(pack.total_price) : null;
  }

  return { ceiling, reference_price: referencePrice, sold_count: soldCount, ...evaluation };
}

// ————————————————————————————————————————— Commandes actives liées (WF #33)

function activeLinesWhere(flashSaleId) {
  return {
    flash_sale_id: flashSaleId,
    parent_item_id: null, // cible pack : on compte la ligne d'en-tête, pas les composants
    order: { is_deleted: false, status: { is_terminal: false, code: { notIn: TERMINAL_CODES } } },
  };
}

async function countActiveOrderLines(flashSaleId) {
  return prisma.orderItem.count({ where: activeLinesWhere(flashSaleId) });
}

async function getDeletionCheck(id, req = null, { auditRefusal = false } = {}) {
  const fs = await prisma.flashSale.findFirst({ where: { id }, select: { id: true, name_fr: true, is_deleted: true, sold_count: true } });
  if (!fs) throw { statusCode: 404, message: 'Vente flash introuvable' };

  const [count, lines] = await Promise.all([
    countActiveOrderLines(id),
    prisma.orderItem.findMany({
      where: activeLinesWhere(id),
      select: {
        qty: true, unit_price_sold: true,
        order: {
          select: {
            id: true, created_at: true, total_ttc: true,
            status: { select: { code: true, name_fr: true } },
            customer: { select: { name: true, phone_number: true } },
          },
        },
      },
      take: 100,
    }),
  ]);

  const seen = new Map();
  for (const l of lines) {
    const o = l.order;
    if (!o || seen.has(o.id)) continue;
    seen.set(o.id, {
      order_id: o.id,
      order_number: `ORD-${o.id.slice(0, 8).toUpperCase()}`,
      created_at: o.created_at,
      status_code: o.status?.code,
      status_label: o.status?.name_fr,
      customer_name: o.customer?.name,
      customer_phone: o.customer?.phone_number,
      total_ttc: Number(o.total_ttc),
      qty: Number(l.qty),
      unit_price_sold: Number(l.unit_price_sold),
    });
  }

  let reason = null;
  if (fs.is_deleted) reason = 'Cette vente flash est déjà supprimée.';
  else if (count > 0) reason = `Suppression refusée : ${count} commande(s) active(s) référencent cette vente flash. Désactivez-la à la place ; la suppression sera possible une fois ces commandes livrées, annulées ou retournées.`;

  if (auditRefusal && reason && !fs.is_deleted) {
    await audit(req, { action: 'DELETE_REFUSED', resource: RESOURCE, resource_id: id, new_values: { active_orders_count: count, reason } });
  }

  return {
    id: fs.id,
    sold_count: fs.sold_count,
    active_orders_count: count,
    active_orders: [...seen.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    can_delete: !reason,
    reason,
  };
}

// ————————————————————————————————————————— Création

/** Prix flash : saisi directement (flash_price) ou dérivé d'une remise (discount_type / discount_value). */
function resolveFlashPrice(body, referencePrice) {
  let price = null;
  if (!isBlank(body.flash_price)) price = Number(body.flash_price);
  else if (!isBlank(body.discount_value)) {
    const type = body.discount_type ?? 'fixed';
    const val = Number(body.discount_value);
    if (type === 'percentage' || type === 'pourcentage') {
      if (!(val > 0 && val <= 100)) throw { statusCode: 400, message: 'Pourcentage de remise invalide (1 à 100)' };
      price = round2(Number(referencePrice ?? 0) * (1 - val / 100));
    } else {
      price = val; // historique : 'fixed' = prix promo saisi
    }
  }
  if (price == null) throw { statusCode: 400, message: 'Le prix flash est obligatoire' };
  if (!Number.isFinite(price) || price < 0) throw { statusCode: 400, message: 'Le prix flash doit être supérieur ou égal à 0' };
  if (referencePrice != null && referencePrice > 0 && price >= referencePrice) {
    throw { statusCode: 400, message: `Le prix flash doit être inférieur au prix normal (${referencePrice} MAD)` };
  }
  return round2(price);
}

async function createFlash(body, req) {
  const nodeId = isBlank(body.node_id) ? null : String(body.node_id);
  const skuId = isBlank(body.sku_id) ? null : String(body.sku_id);
  const packId = isBlank(body.pack_id) ? null : String(body.pack_id);

  if (!nodeId) throw { statusCode: 400, message: 'Sélectionnez le node : une vente flash est toujours rattachée à un node' };
  const node = await prisma.node.findFirst({ where: { id: nodeId, is_deleted: false }, select: { id: true } });
  if (!node) throw { statusCode: 400, message: 'Node introuvable' };
  if (!!skuId === !!packId) throw { statusCode: 400, message: 'Choisissez la cible : un produit (SKU) OU un pack' };

  const ceiling = await computeCeiling({ node_id: nodeId, sku_id: skuId, pack_id: packId });

  let referencePrice;
  if (skuId) {
    const sku = await prisma.sku.findUnique({
      where: { id: skuId },
      select: { price: true, vat_rate: true, tax: { select: { rate: true } }, selling_rules: { where: { node_id: nodeId }, select: { node_id: true, price: true } } },
    });
    referencePrice = referencePriceOf({ node_id: nodeId, sku });
  } else {
    const pack = await prisma.pack.findUnique({ where: { id: packId }, select: { total_price: true } });
    referencePrice = round2(pack.total_price);
  }
  const flashPrice = resolveFlashPrice(body, referencePrice);

  if (isBlank(body.stock_flash)) throw { statusCode: 400, message: 'Le plafond flash (stock_flash) est obligatoire' };
  const stockFlash = Number(body.stock_flash);
  const maxQty = isBlank(body.max_qty_per_user) ? 1 : Number(body.max_qty_per_user);
  if (!Number.isInteger(maxQty) || maxQty < 1) throw { statusCode: 400, message: 'La quantité max par client doit être un entier ≥ 1' };

  if (isBlank(body.starts_at) || isBlank(body.ends_at)) throw { statusCode: 400, message: 'Les dates de début et de fin sont obligatoires' };
  const startsAt = parseDate(body.starts_at, 'Date de début');
  const endsAt = parseDate(body.ends_at, 'Date de fin');
  if (endsAt <= startsAt) throw { statusCode: 400, message: 'La date de fin doit être postérieure à la date de début' };
  if (endsAt <= new Date()) throw { statusCode: 400, message: 'La date de fin doit être dans le futur' };

  const evaluation = evaluateStockFlash(ceiling, stockFlash, { soldCount: 0, changed: true, creation: true });
  if (evaluation.errors.length) {
    await audit(req, {
      action: 'CREATE_REFUSED', resource: RESOURCE,
      new_values: { node_id: nodeId, sku_id: skuId, pack_id: packId, stock_flash: stockFlash, reason: evaluation.errors },
    });
    throw { statusCode: 400, message: evaluation.errors.join(' ') };
  }

  const isActive = has(body, 'is_active') ? parseBool(body.is_active) : false; // WF #1 : Sauvegarder → inactif
  const created = await prisma.flashSale.create({
    data: {
      node_id: nodeId,
      sku_id: skuId,
      pack_id: packId,
      name_fr: isBlank(body.name_fr) ? null : String(body.name_fr),
      name_ar: isBlank(body.name_ar) ? null : String(body.name_ar),
      image_url: isBlank(body.image_url) ? null : String(body.image_url),
      flash_price: flashPrice,
      discount_type: 'fixed',
      discount_value: referencePrice != null ? round2(Math.max(0, referencePrice - flashPrice)) : null,
      stock_flash: stockFlash,
      sold_count: 0,
      max_qty_per_user: maxQty,
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: isActive,
      created_by: req?.user?.id,
    },
    include: FLASH_INCLUDE,
  });

  await audit(req, { action: 'CREATE', resource: RESOURCE, resource_id: created.id, new_values: snapshot(created) });
  const formatted = formatPromo(created);
  if (isActive) notifyFlash(formatted);
  return { ...formatted, warnings: evaluation.warnings, ceiling };
}

function notifyFlash(formatted) {
  const label = formatted.discount_pct != null ? `-${formatted.discount_pct}%` : `${formatted.flash_price} MAD`;
  notifyFlashSaleCreated(
    label,
    formatted.scope_name ?? formatted.name_fr ?? 'une sélection de produits',
    new Date(formatted.ends_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
  ).catch(() => {});
}

/** Promotions catégorie / marque (« Autres promotions ») — comportement historique. */
async function createOther(body, req) {
  const { category_id, brand_id, node_id, name_fr, name_ar, image_url, discount_type = 'fixed', discount_value, max_qty_per_user = 1, starts_at, ends_at } = body;
  if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
  if (discount_value == null || discount_value === '') throw { statusCode: 400, message: 'discount_value requis' };
  if (!starts_at || !ends_at) throw { statusCode: 400, message: 'Dates de début et fin requises' };
  if (new Date(ends_at) <= new Date(starts_at)) throw { statusCode: 400, message: 'La date de fin doit être après la date de début' };
  validateDiscount(discount_type, discount_value);
  if (!isBlank(category_id)) {
    const cat = await prisma.category.findUnique({ where: { id: String(category_id) } });
    if (!cat) throw { statusCode: 404, message: 'Catégorie introuvable' };
  }
  if (!isBlank(brand_id)) {
    const brand = await prisma.brand.findUnique({ where: { id: Number(brand_id) } });
    if (!brand) throw { statusCode: 404, message: 'Marque introuvable' };
  }
  const created = await prisma.flashSale.create({
    data: {
      category_id: isBlank(category_id) ? null : String(category_id),
      brand_id: isBlank(brand_id) ? null : Number(brand_id),
      node_id: String(node_id),
      name_fr: name_fr || null,
      name_ar: name_ar || null,
      image_url: image_url || null,
      discount_type,
      discount_value: Number(discount_value),
      flash_price: null,
      stock_flash: null,
      max_qty_per_user: Number(max_qty_per_user ?? 1),
      starts_at: new Date(starts_at),
      ends_at: new Date(ends_at),
      is_active: has(body, 'is_active') ? parseBool(body.is_active) : true,
      created_by: req?.user?.id,
    },
    include: FLASH_INCLUDE,
  });
  await audit(req, { action: 'CREATE', resource: RESOURCE, resource_id: created.id, new_values: snapshot(created) });
  const formatted = formatPromo(created);
  if (created.is_active) notifyFlash(formatted);
  return formatted;
}

async function CreatePromotion(body, req) {
  const scopes = ['sku_id', 'pack_id', 'category_id', 'brand_id'].filter((k) => !isBlank(body?.[k]));
  if (scopes.length !== 1) {
    throw { statusCode: 400, message: 'Renseignez exactement une cible : produit (SKU), pack, catégorie ou marque' };
  }
  if (scopes[0] === 'sku_id' || scopes[0] === 'pack_id') return createFlash(body, req);
  return createOther(body, req);
}

// ————————————————————————————————————————— Modification (WF #18, US-075 bloc 1)

async function updateFlash(existing, body, req) {
  const id = existing.id;
  const now = new Date();
  const isExpired = new Date(existing.ends_at) < now;

  // G. node et cible jamais modifiables
  for (const k of ['node_id', 'sku_id', 'pack_id']) {
    if (has(body, k) && !isBlank(body[k]) && String(body[k]) !== String(existing[k] ?? '')) {
      await refuse(req, id, 'UPDATE_REFUSED', 'Le node et la cible (produit ou pack) ne sont jamais modifiables après création : désactivez cette vente flash et créez-en une nouvelle.');
    }
  }
  if (has(body, 'sold_count') && Number(body.sold_count) !== existing.sold_count) {
    await refuse(req, id, 'UPDATE_REFUSED', 'Le compteur de ventes (sold_count) n\'est jamais saisissable : il est piloté par les commandes.');
  }

  const data = {};
  const warnings = [];

  if (has(body, 'name_fr')) data.name_fr = isBlank(body.name_fr) ? null : String(body.name_fr);
  if (has(body, 'name_ar')) data.name_ar = isBlank(body.name_ar) ? null : String(body.name_ar);
  if (has(body, 'image_url')) data.image_url = isBlank(body.image_url) ? null : String(body.image_url);
  if (has(body, 'max_qty_per_user')) {
    const v = Number(body.max_qty_per_user);
    if (!Number.isInteger(v) || v < 1) throw { statusCode: 400, message: 'La quantité max par client doit être un entier ≥ 1' };
    data.max_qty_per_user = v;
  }
  if (has(body, 'starts_at') && !isBlank(body.starts_at)) data.starts_at = parseDate(body.starts_at, 'Date de début');
  if (has(body, 'ends_at') && !isBlank(body.ends_at)) data.ends_at = parseDate(body.ends_at, 'Date de fin');
  if (has(body, 'is_active')) data.is_active = parseBool(body.is_active);
  if (has(body, 'stock_flash') && !isBlank(body.stock_flash)) data.stock_flash = Number(body.stock_flash);

  // Prix flash (saisi ou via remise)
  const priceProvided = (has(body, 'flash_price') && !isBlank(body.flash_price)) || (has(body, 'discount_value') && !isBlank(body.discount_value));
  let referencePrice = null;
  if (priceProvided) {
    const full = await prisma.flashSale.findUnique({ where: { id }, include: FLASH_INCLUDE });
    referencePrice = referencePriceOf(full);
    const price = resolveFlashPrice(body, referencePrice);
    data.flash_price = price;
    data.discount_type = 'fixed';
    data.discount_value = referencePrice != null ? round2(Math.max(0, referencePrice - price)) : null;
  }

  // Ne garder que les champs réellement modifiés
  const same = (a, b) => {
    if (a instanceof Date || b instanceof Date) return a && b && new Date(a).getTime() === new Date(b).getTime();
    if (a == null || b == null) return (a ?? null) === (b ?? null);
    if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
    return a === b;
  };
  const current = (k) => {
    const v = existing[k];
    if (v != null && typeof v === 'object' && !(v instanceof Date)) return Number(v); // Prisma.Decimal
    return v;
  };
  for (const k of Object.keys(data)) {
    if (same(data[k], current(k))) delete data[k];
  }
  if (data.flash_price === undefined) { delete data.discount_type; delete data.discount_value; }
  const changed = Object.keys(data);
  if (!changed.length) {
    return formatPromo(await prisma.flashSale.findUnique({ where: { id }, include: FLASH_INCLUDE }));
  }

  // A. contrôle d'accès : expirée = lecture seule (seule une désactivation reste sans effet mais permise)
  if (isExpired) {
    const onlyDeactivate = changed.length === 1 && changed[0] === 'is_active' && data.is_active === false;
    if (!onlyDeactivate) {
      await refuse(req, id, 'UPDATE_REFUSED', 'Vente flash terminée : elle est en lecture seule. Créez une nouvelle vente flash.');
    }
  }

  // F. fenêtre de dates
  if (data.starts_at && now >= new Date(existing.starts_at)) {
    await refuse(req, id, 'UPDATE_REFUSED', 'La vente a déjà démarré : la date de début est figée (seule la date de fin reste modifiable).');
  }
  const start = data.starts_at ?? existing.starts_at;
  const end = data.ends_at ?? existing.ends_at;
  if (new Date(end) <= new Date(start)) {
    throw { statusCode: 400, message: 'La date de fin doit être postérieure à la date de début' };
  }
  if (data.ends_at && new Date(data.ends_at) < now) {
    warnings.push('La nouvelle date de fin est déjà passée : la vente devient immédiatement terminée.');
  }

  // C. prix flash : avertissement si des ventes existent déjà au prix précédent
  if (data.flash_price !== undefined) {
    const soldLines = existing.sold_count > 0 ? existing.sold_count : await prisma.orderItem.count({ where: { flash_sale_id: id } });
    if (soldLines > 0) {
      warnings.push('Le nouveau prix flash ne s\'applique qu\'aux ventes futures : les commandes passées conservent leur prix figé, deux prix flash coexisteront dans l\'historique.');
    }
  }

  // D. plafond flash : contrôle A (>= sold_count) et contrôle B (plafond maximal), recalculé à chaque enregistrement
  const newStock = data.stock_flash ?? existing.stock_flash ?? 0;
  const stockChanged = data.stock_flash !== undefined;
  let ceiling = null;
  try {
    ceiling = await computeCeiling({ node_id: existing.node_id, sku_id: existing.sku_id, pack_id: existing.pack_id });
  } catch (e) {
    if (stockChanged) throw e;
    warnings.push(e?.message || 'Plafond flash non calculable');
  }
  if (ceiling) {
    const evaluation = evaluateStockFlash(ceiling, newStock, { soldCount: existing.sold_count, changed: stockChanged });
    if (evaluation.errors.length) {
      await refuse(req, id, 'UPDATE_REFUSED', evaluation.errors.join(' '), { stock_flash: newStock });
    }
    warnings.push(...evaluation.warnings);
  }

  // E. réactivation impossible si terminée
  if (data.is_active === true && isExpired) {
    await refuse(req, id, 'UPDATE_REFUSED', 'Réactivation impossible : la vente flash est terminée.');
  }

  const updated = await prisma.flashSale.update({ where: { id }, data, include: FLASH_INCLUDE });
  await audit(req, { action: 'UPDATE', resource: RESOURCE, resource_id: id, old_values: snapshot(existing), new_values: snapshot(updated) });
  return { ...formatPromo(updated), warnings };
}

async function updateOther(existing, body, req) {
  const data = {};
  if (has(body, 'name_fr'))          data.name_fr = body.name_fr || null;
  if (has(body, 'name_ar'))          data.name_ar = body.name_ar || null;
  if (has(body, 'image_url'))        data.image_url = body.image_url || null;
  if (has(body, 'max_qty_per_user')) data.max_qty_per_user = Number(body.max_qty_per_user);
  if (has(body, 'is_active'))        data.is_active = parseBool(body.is_active);
  if (has(body, 'starts_at') && !isBlank(body.starts_at)) data.starts_at = parseDate(body.starts_at, 'Date de début');
  if (has(body, 'ends_at') && !isBlank(body.ends_at))     data.ends_at = parseDate(body.ends_at, 'Date de fin');

  if (has(body, 'discount_type') || has(body, 'discount_value')) {
    const discount_type  = body.discount_type  ?? existing.discount_type;
    const discount_value = body.discount_value ?? existing.discount_value;
    validateDiscount(discount_type, discount_value);
    data.discount_type  = discount_type;
    data.discount_value = discount_value != null ? Number(discount_value) : null;
  }

  const start = data.starts_at ?? existing.starts_at;
  const end   = data.ends_at   ?? existing.ends_at;
  if (new Date(end) <= new Date(start)) throw { statusCode: 400, message: 'La date de fin doit être après la date de début' };
  if (data.is_active === true && new Date(end) < new Date()) {
    throw { statusCode: 400, message: 'Réactivation impossible : la promotion est terminée' };
  }

  const updated = await prisma.flashSale.update({ where: { id: existing.id }, data, include: FLASH_INCLUDE });
  await audit(req, { action: 'UPDATE', resource: RESOURCE, resource_id: existing.id, old_values: snapshot(existing), new_values: snapshot(updated) });
  return formatPromo(updated);
}

async function updatePromotion(id, body, req = null) {
  const existing = await prisma.flashSale.findFirst({ where: { id } });
  if (!existing) throw { statusCode: 404, message: 'Vente flash introuvable' };
  if (existing.is_deleted) {
    await refuse(req, id, 'UPDATE_REFUSED', 'Vente flash supprimée : elle ne peut plus être ni modifiée ni réactivée.');
  }
  if (existing.sku_id || existing.pack_id) return updateFlash(existing, body ?? {}, req);
  return updateOther(existing, body ?? {}, req);
}

// ————————————————————————————————————————— Activation (WF #18 section E)

async function setActive(id, isActive, req = null) {
  const existing = await prisma.flashSale.findFirst({ where: { id } });
  if (!existing) throw { statusCode: 404, message: 'Vente flash introuvable' };
  if (existing.is_deleted) {
    await refuse(req, id, 'UPDATE_REFUSED', 'Vente flash supprimée : elle ne peut plus être réactivée.');
  }
  const value = parseBool(isActive);
  if (value && new Date(existing.ends_at) < new Date()) {
    await refuse(req, id, 'UPDATE_REFUSED', 'Réactivation impossible : la vente flash est terminée (date de fin dépassée). Créez une nouvelle vente flash.');
  }
  if (existing.is_active === value) return formatPromo(await prisma.flashSale.findUnique({ where: { id }, include: FLASH_INCLUDE }));

  const updated = await prisma.flashSale.update({ where: { id }, data: { is_active: value }, include: FLASH_INCLUDE });
  await audit(req, {
    action: value ? 'ACTIVATE' : 'DEACTIVATE', resource: RESOURCE, resource_id: id,
    old_values: { is_active: existing.is_active }, new_values: { is_active: value },
  });
  const formatted = formatPromo(updated);
  if (value) notifyFlash(formatted);
  return formatted;
}

// ————————————————————————————————————————— Suppression (WF #33, US-075 bloc 3)

async function removePromotion(id, req = null) {
  const check = await getDeletionCheck(id);
  if (!check.can_delete) {
    await audit(req, { action: 'DELETE_REFUSED', resource: RESOURCE, resource_id: id, new_values: { active_orders_count: check.active_orders_count, reason: check.reason } });
    throw { statusCode: 409, message: check.reason, details: check };
  }
  const existing = await prisma.flashSale.findUnique({ where: { id } });
  const deleted = await prisma.flashSale.update({
    where: { id },
    data: { is_deleted: true, deleted_at: new Date(), is_active: false },
  });
  await audit(req, { action: 'DELETE', resource: RESOURCE, resource_id: id, old_values: snapshot(existing), new_values: snapshot(deleted) });
  return { id };
}

module.exports = {
  getAll, getById, CreatePromotion, updatePromotion, removePromotion,
  setActive, getDeletionCheck, getFlashLookups, getCeiling,
};
