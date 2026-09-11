/**
 * Grille de prix fournisseur × SKU (supplier_prices) — US-051.
 *
 * Règles :
 *  - paliers de quantité [qty_min ; qty_max] (qty_max NULL = sans plafond). Deux paliers
 *    actifs d'un même couple fournisseur × SKU ne peuvent pas se chevaucher sur une même
 *    période de validité (une borne commune est tolérée : le palier supérieur s'applique) ;
 *  - prix HT unitaire, période de validité [valid_from ; valid_to] (valid_to NULL = ouverte) ;
 *  - une renégociation crée TOUJOURS une nouvelle ligne : l'ancienne est clôturée
 *    (valid_to = veille de la nouvelle date d'effet) et conservée pour l'historique.
 */
const prisma = require('../../config/database');
const { audit } = require('../../utils/audit');
const {
  bad, assertUuid, isUuid, num, parseNumber, parseDateOnly, parseBool, todayDateOnly, addDays,
  fmtDate, pagination, pageMeta,
} = require('./purchasing.shared');

const INCLUDE = {
  supplier: { select: { id: true, code: true, name_fr: true, name_ar: true, is_active: true, is_deleted: true, payment_terms: true, lead_time_days: true } },
  sku: { select: { id: true, sku_code: true, name_fr: true, name_ar: true, ean13: true, unit_purchase: true } },
};

function validityStatus(p, today = todayDateOnly()) {
  if (!p.is_active) return 'inactive';
  if (p.valid_from > today) return 'future';
  if (p.valid_to && p.valid_to < today) return 'expired';
  return 'current';
}

function format(p) {
  if (!p) return p;
  return {
    ...p,
    price_ht: num(p.price_ht),
    unit_price_ht: num(p.price_ht), // alias (nom Schema V3)
    qty_min: num(p.qty_min),
    qty_max: num(p.qty_max),
    valid_from: fmtDate(p.valid_from),
    valid_to: fmtDate(p.valid_to),
    validity_status: validityStatus(p),
  };
}

const INF = Number.POSITIVE_INFINITY;
const rangesOverlap = (aMin, aMax, bMin, bMax) => aMin < (bMax ?? INF) && bMin < (aMax ?? INF);
const datesOverlap = (aFrom, aTo, bFrom, bTo) =>
  aFrom.getTime() <= (bTo ? bTo.getTime() : INF) && bFrom.getTime() <= (aTo ? aTo.getTime() : INF);

/** Refuse un palier qui chevauche un palier actif existant (même fournisseur × SKU, périodes qui se recoupent). */
async function assertNoOverlap(client, { supplier_id, sku_id, qty_min, qty_max, valid_from, valid_to }, excludeIds = []) {
  const others = await client.supplierPrice.findMany({
    where: { supplier_id, sku_id, is_active: true, ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}) },
  });
  const clash = others.find((o) =>
    rangesOverlap(qty_min, qty_max, Number(o.qty_min), num(o.qty_max))
    && datesOverlap(valid_from, valid_to, o.valid_from, o.valid_to));
  if (clash) {
    const range = `${Number(clash.qty_min)} → ${clash.qty_max == null ? '∞' : Number(clash.qty_max)}`;
    const period = `${fmtDate(clash.valid_from)} → ${clash.valid_to ? fmtDate(clash.valid_to) : 'sans fin'}`;
    throw bad(`Ce palier chevauche un prix existant (qté ${range}, validité ${period}). Utilisez « Renégocier » pour le remplacer, ou clôturez-le.`, 409);
  }
}

function readTier(body, defaults = {}) {
  const qty_min = parseNumber(body.qty_min ?? defaults.qty_min ?? 1, 'Quantité minimum', { min: 0 });
  const qtyMaxRaw = body.qty_max !== undefined ? body.qty_max : defaults.qty_max;
  const qty_max = parseNumber(qtyMaxRaw, 'Quantité maximum', { min: 0 }) ?? null;
  if (qty_max !== null && qty_max <= qty_min) throw bad('La quantité maximum doit être supérieure à la quantité minimum');
  const price_ht = parseNumber(body.price_ht ?? body.unit_price_ht, 'Prix HT', { min: 0, required: true });
  const valid_from = parseDateOnly(body.valid_from, 'Date de début de validité') || todayDateOnly();
  const valid_to = parseDateOnly(body.valid_to, 'Date de fin de validité') ?? null;
  if (valid_to && valid_to < valid_from) throw bad('La date de fin de validité doit être postérieure à la date de début');
  return { qty_min, qty_max, price_ht, valid_from, valid_to };
}

async function assertSupplier(id) {
  assertUuid(id, 'Fournisseur');
  const s = await prisma.supplier.findFirst({ where: { id, is_deleted: false } });
  if (!s) throw bad('Fournisseur introuvable', 404);
  return s;
}

async function assertSku(id) {
  assertUuid(id, 'SKU');
  const s = await prisma.sku.findFirst({ where: { id, is_deleted: false, deleted_at: null } });
  if (!s) throw bad('SKU introuvable', 404);
  return s;
}

async function findOr404(id) {
  assertUuid(id, 'Identifiant du prix');
  const p = await prisma.supplierPrice.findUnique({ where: { id } });
  if (!p) throw bad('Prix fournisseur introuvable', 404);
  return p;
}

// ─── Lecture ─────────────────────────────────────────────────────────────────

async function list(query = {}) {
  const where = {};
  if (query.supplier_id) where.supplier_id = assertUuid(query.supplier_id, 'Fournisseur');
  if (query.sku_id) where.sku_id = assertUuid(query.sku_id, 'SKU');

  const today = todayDateOnly();
  const validity = query.validity || '';
  const includeInactive = parseBool(query.include_inactive) || validity === 'inactive';
  if (validity === 'inactive') where.is_active = false;
  else if (!includeInactive) where.is_active = true;

  if (validity === 'current') {
    where.valid_from = { lte: today };
    where.AND = [{ OR: [{ valid_to: null }, { valid_to: { gte: today } }] }];
  } else if (validity === 'future') {
    where.valid_from = { gt: today };
  } else if (validity === 'expired') {
    where.valid_to = { lt: today };
  }

  const search = String(query.search || '').trim();
  if (search) {
    where.OR = [
      { sku: { sku_code: { contains: search, mode: 'insensitive' } } },
      { sku: { name_fr: { contains: search, mode: 'insensitive' } } },
      { sku: { name_ar: { contains: search, mode: 'insensitive' } } },
      { sku: { ean13: { contains: search, mode: 'insensitive' } } },
      { supplier: { name_fr: { contains: search, mode: 'insensitive' } } },
      { supplier: { code: { contains: search, mode: 'insensitive' } } },
    ];
  }
  if (!parseBool(query.include_deleted_suppliers)) {
    where.supplier = { is_deleted: false };
  }

  const orderBy = [{ sku: { name_fr: 'asc' } }, { supplier: { name_fr: 'asc' } }, { qty_min: 'asc' }, { valid_from: 'desc' }];

  if (parseBool(query.all)) {
    const rows = await prisma.supplierPrice.findMany({ where, include: INCLUDE, orderBy, take: 5000 });
    return { data: rows.map(format), pagination: pageMeta(rows.length, 1, Math.max(1, rows.length)) };
  }
  const { page, limit, skip } = pagination(query, 50);
  const [rows, total] = await Promise.all([
    prisma.supplierPrice.findMany({ where, include: INCLUDE, orderBy, skip, take: limit }),
    prisma.supplierPrice.count({ where }),
  ]);
  return { data: rows.map(format), pagination: pageMeta(total, page, limit) };
}

async function getById(id) {
  await findOr404(id);
  return format(await prisma.supplierPrice.findUnique({ where: { id }, include: INCLUDE }));
}

/**
 * Prix applicable pour un fournisseur × SKU × quantité à une date donnée
 * (utilisé pour valoriser les lignes de BC). null si aucun prix ne s'applique.
 */
async function findApplicable({ supplier_id, sku_id, qty = 1, date } = {}, client = prisma) {
  if (!isUuid(supplier_id) || !isUuid(sku_id)) return null;
  const at = date instanceof Date ? date : (parseDateOnly(date, 'Date') || todayDateOnly());
  const q = Number(qty) > 0 ? Number(qty) : 1;
  const rows = await client.supplierPrice.findMany({
    where: {
      supplier_id, sku_id, is_active: true,
      valid_from: { lte: at },
      OR: [{ valid_to: null }, { valid_to: { gte: at } }],
      qty_min: { lte: q },
    },
    orderBy: [{ qty_min: 'desc' }, { valid_from: 'desc' }],
  });
  const hit = rows.find((r) => r.qty_max == null || Number(r.qty_max) >= q);
  return hit ? format(hit) : null;
}

async function best(query = {}) {
  assertUuid(query.supplier_id, 'Fournisseur');
  assertUuid(query.sku_id, 'SKU');
  return findApplicable(query);
}

// ─── Écriture ────────────────────────────────────────────────────────────────

async function create(body = {}, req) {
  const supplier = await assertSupplier(body.supplier_id);
  await assertSku(body.sku_id);
  const tier = readTier(body);
  const data = { supplier_id: supplier.id, sku_id: body.sku_id, ...tier, is_active: true };
  await assertNoOverlap(prisma, data);
  const p = await prisma.supplierPrice.create({ data, include: INCLUDE });
  await audit(req, { action: 'CREATE', resource: 'supplier_prices', resource_id: p.id, new_values: format(p) });
  return format(p);
}

/**
 * Renégociation : nouvelle ligne de prix ; l'ancienne est clôturée à la veille de la
 * nouvelle date d'effet (elle reste en base pour l'historique).
 */
async function renegotiate(id, body = {}, req) {
  const old = await findOr404(id);
  if (!old.is_active) throw bad('Ce prix est désactivé : créez un nouveau prix plutôt que de le renégocier');
  const tier = readTier(body, { qty_min: Number(old.qty_min), qty_max: num(old.qty_max) });
  if (tier.valid_from <= old.valid_from) {
    throw bad(`La nouvelle date d'effet doit être postérieure au ${fmtDate(old.valid_from)} (début de l'ancien prix)`);
  }
  // Clôture à la veille de la nouvelle date d'effet (sauf si l'ancien prix se termine déjà avant).
  const closeAt = addDays(tier.valid_from, -1);
  const newValidTo = old.valid_to && old.valid_to < closeAt ? old.valid_to : closeAt;

  const result = await prisma.$transaction(async (tx) => {
    await tx.supplierPrice.update({ where: { id }, data: { valid_to: newValidTo } });
    const data = { supplier_id: old.supplier_id, sku_id: old.sku_id, ...tier, is_active: true };
    await assertNoOverlap(tx, data, [id]);
    return tx.supplierPrice.create({ data, include: INCLUDE });
  });

  await audit(req, {
    action: 'RENEGOTIATE',
    resource: 'supplier_prices',
    resource_id: result.id,
    old_values: { ...format(old), closed_to: fmtDate(newValidTo) },
    new_values: format(result),
  });
  return { previous: format({ ...old, valid_to: newValidTo }), current: format(result) };
}

/** Modification limitée : fin de validité et activation (le prix et les paliers passent par la renégociation). */
async function update(id, body = {}, req) {
  const old = await findOr404(id);
  const data = {};
  if (body.valid_to !== undefined) {
    const vt = parseDateOnly(body.valid_to, 'Date de fin de validité');
    if (vt && vt < old.valid_from) throw bad('La date de fin de validité doit être postérieure à la date de début');
    data.valid_to = vt;
  }
  const active = parseBool(body.is_active);
  if (active !== undefined) data.is_active = active;
  if (body.price_ht !== undefined || body.qty_min !== undefined || body.qty_max !== undefined || body.valid_from !== undefined) {
    throw bad('Le prix, les paliers et la date de début ne se modifient pas : utilisez « Renégocier » (une nouvelle ligne est créée)');
  }
  if (!Object.keys(data).length) throw bad('Aucune modification fournie');

  const next = { ...old, ...data };
  if (next.is_active) {
    await assertNoOverlap(prisma, {
      supplier_id: old.supplier_id, sku_id: old.sku_id,
      qty_min: Number(old.qty_min), qty_max: num(old.qty_max),
      valid_from: old.valid_from, valid_to: next.valid_to,
    }, [id]);
  }
  const p = await prisma.supplierPrice.update({ where: { id }, data, include: INCLUDE });
  await audit(req, { action: 'UPDATE', resource: 'supplier_prices', resource_id: id, old_values: format(old), new_values: format(p) });
  return format(p);
}

/** Désactivation (pas de suppression physique). */
async function remove(id, req) {
  const old = await findOr404(id);
  if (!old.is_active) return format(old);
  const p = await prisma.supplierPrice.update({ where: { id }, data: { is_active: false }, include: INCLUDE });
  await audit(req, { action: 'DEACTIVATE', resource: 'supplier_prices', resource_id: id, old_values: { is_active: true }, new_values: { is_active: false } });
  return format(p);
}

module.exports = { list, getById, best, findApplicable, create, renegotiate, update, remove };
