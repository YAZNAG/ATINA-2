const prisma = require('../../config/database');
const { audit } = require('../../utils/audit');
const {
  OPEN_PO_STATUSES, bad, assertUuid, num, round, optText, parseNumber, parseBool,
  pagination, pageMeta, isUniqueViolation,
} = require('./purchasing.shared');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const OPEN_PO_WHERE = { is_deleted: false, status: { code: { in: OPEN_PO_STATUSES } } };

function format(s, extra = {}) {
  if (!s) return s;
  const { _count, ...rest } = s;
  return {
    ...rest,
    score: num(s.score),
    status: s.is_deleted ? 'deleted' : s.is_active ? 'active' : 'inactive',
    prices_count: _count?.prices,
    open_po_count: _count?.purchase_orders,
    ...extra,
  };
}

/** Lit et valide les champs éditables d'un fournisseur. */
function readFields(body, { partial }) {
  const data = {};

  if (!partial || body.code !== undefined) {
    const code = optText(body.code, 50, 'Code');
    if (!code) throw bad('Code fournisseur requis');
    data.code = code.toUpperCase();
  }
  if (!partial || body.name_fr !== undefined) {
    const v = optText(body.name_fr, 200, 'Nom (FR)');
    if (!v) throw bad('Nom (FR) requis');
    data.name_fr = v;
  }
  if (!partial || body.name_ar !== undefined) {
    const v = optText(body.name_ar, 200, 'Nom (AR)');
    if (!v) throw bad('Nom (AR) requis');
    data.name_ar = v;
  }

  const txt = [
    ['contact_name', 150, 'Nom du contact'],
    ['contact_phone', 30, 'Téléphone'],
    ['contact_email', 150, 'E-mail'],
    ['address', 1000, 'Adresse'],
    ['payment_terms', 150, 'Conditions de paiement'],
    ['notes', 5000, 'Notes'],
  ];
  for (const [k, max, label] of txt) {
    const v = optText(body[k], max, label);
    if (v !== undefined) data[k] = v;
  }
  if (data.contact_email && !EMAIL_RE.test(data.contact_email)) throw bad('E-mail du contact invalide');

  const lead = parseNumber(body.lead_time_days, 'Délai de livraison (jours)', { min: 0, max: 365, integer: true });
  if (lead !== undefined) data.lead_time_days = lead === null ? 1 : lead;

  // Colonne DECIMAL(3,1) : 0 à 99,9.
  const score = parseNumber(body.score, 'Score', { min: 0, max: 99.9 });
  if (score !== undefined) data.score = score === null ? null : round(score, 1);

  const active = parseBool(body.is_active);
  if (active !== undefined) data.is_active = active;

  return data;
}

async function countOpenPos(supplierId, client = prisma) {
  return client.purchaseOrder.count({ where: { supplier_id: supplierId, ...OPEN_PO_WHERE } });
}

async function findOr404(id, { includeDeleted = false } = {}) {
  assertUuid(id, 'Identifiant fournisseur');
  const s = await prisma.supplier.findFirst({ where: { id, ...(includeDeleted ? {} : { is_deleted: false }) } });
  if (!s) throw bad('Fournisseur introuvable', 404);
  return s;
}

async function assertCodeFree(code, exceptId) {
  const clash = await prisma.supplier.findFirst({
    where: { code: { equals: code, mode: 'insensitive' }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true, is_deleted: true },
  });
  if (clash) {
    throw bad(clash.is_deleted
      ? `Le code ${code} est déjà utilisé par un fournisseur supprimé (restaurez-le plutôt)`
      : `Le code ${code} est déjà utilisé par un autre fournisseur`, 409);
  }
}

// ─── Lecture ─────────────────────────────────────────────────────────────────

async function list(query = {}) {
  const where = {};
  const status = query.status || '';
  if (status === 'deleted') where.is_deleted = true;
  else {
    where.is_deleted = false;
    if (status === 'active') where.is_active = true;
    if (status === 'inactive') where.is_active = false;
  }
  const search = String(query.search || '').trim();
  if (search) {
    where.OR = ['code', 'name_fr', 'name_ar', 'contact_name', 'contact_email', 'contact_phone'].map((f) => ({
      [f]: { contains: search, mode: 'insensitive' },
    }));
  }

  const include = {
    _count: {
      select: {
        prices: { where: { is_active: true } },
        purchase_orders: { where: OPEN_PO_WHERE },
      },
    },
  };

  const all = parseBool(query.all);
  if (all) {
    const rows = await prisma.supplier.findMany({ where, include, orderBy: { name_fr: 'asc' } });
    return { data: rows.map((r) => format(r)), pagination: pageMeta(rows.length, 1, Math.max(1, rows.length)) };
  }

  const { page, limit, skip } = pagination(query);
  const [rows, total] = await Promise.all([
    prisma.supplier.findMany({ where, include, orderBy: { name_fr: 'asc' }, skip, take: limit }),
    prisma.supplier.count({ where }),
  ]);
  return { data: rows.map((r) => format(r)), pagination: pageMeta(total, page, limit) };
}

async function getById(id) {
  const s = await findOr404(id, { includeDeleted: true });
  const [openPo, poAgg, pricesCount, lastPo] = await Promise.all([
    countOpenPos(id),
    prisma.purchaseOrder.aggregate({
      where: { supplier_id: id, is_deleted: false, status: { code: { not: 'cancelled' } } },
      _count: { _all: true },
      _sum: { total_ht: true },
    }),
    prisma.supplierPrice.count({ where: { supplier_id: id, is_active: true } }),
    prisma.purchaseOrder.findFirst({
      where: { supplier_id: id, is_deleted: false },
      orderBy: { created_at: 'desc' },
      select: { id: true, reference: true, created_at: true },
    }),
  ]);
  return format(s, {
    open_po_count: openPo,
    prices_count: pricesCount,
    po_count: poAgg._count._all,
    po_total_ht: num(poAgg._sum.total_ht) ?? 0,
    last_po: lastPo,
  });
}

// ─── Écriture ────────────────────────────────────────────────────────────────

async function create(body = {}, req) {
  const data = readFields(body, { partial: false });
  if (data.lead_time_days === undefined) data.lead_time_days = 3; // défaut métier (Schema V3)
  await assertCodeFree(data.code);
  try {
    const s = await prisma.supplier.create({ data });
    await audit(req, { action: 'CREATE', resource: 'suppliers', resource_id: s.id, new_values: s });
    return format(s, { open_po_count: 0, prices_count: 0 });
  } catch (err) {
    if (isUniqueViolation(err)) throw bad('Ce code fournisseur existe déjà', 409);
    throw err;
  }
}

async function update(id, body = {}, req) {
  const current = await findOr404(id);
  const data = readFields(body, { partial: true });
  if (data.code && data.code !== current.code) await assertCodeFree(data.code, id);

  if (data.is_active === false && current.is_active) {
    const open = await countOpenPos(id);
    if (open > 0) {
      throw bad(`Impossible de désactiver ce fournisseur : ${open} bon(s) de commande en cours. Clôturez-les ou annulez-les d'abord.`, 409);
    }
  }
  try {
    const s = await prisma.supplier.update({ where: { id }, data });
    await audit(req, { action: 'UPDATE', resource: 'suppliers', resource_id: id, old_values: current, new_values: s });
    return getById(id);
  } catch (err) {
    if (isUniqueViolation(err)) throw bad('Ce code fournisseur existe déjà', 409);
    throw err;
  }
}

async function toggleStatus(id, req) {
  const current = await findOr404(id);
  return update(id, { is_active: !current.is_active }, req);
}

async function remove(id, req) {
  const current = await findOr404(id);
  const open = await countOpenPos(id);
  if (open > 0) {
    throw bad(`Impossible de supprimer ce fournisseur : ${open} bon(s) de commande en cours.`, 409);
  }
  const s = await prisma.supplier.update({
    where: { id },
    data: { is_deleted: true, deleted_at: new Date(), is_active: false },
  });
  await audit(req, { action: 'DELETE', resource: 'suppliers', resource_id: id, old_values: current, new_values: { is_deleted: true } });
  return format(s);
}

async function restore(id, req) {
  const current = await findOr404(id, { includeDeleted: true });
  if (!current.is_deleted) throw bad("Ce fournisseur n'est pas supprimé");
  const s = await prisma.supplier.update({ where: { id }, data: { is_deleted: false, deleted_at: null, is_active: true } });
  await audit(req, { action: 'RESTORE', resource: 'suppliers', resource_id: id, old_values: { is_deleted: true }, new_values: { is_deleted: false } });
  return format(s);
}

module.exports = { list, getById, create, update, toggleStatus, remove, restore, countOpenPos };
