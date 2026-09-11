const prisma = require('../../../config/database');

const N = (v) => Number(v ?? 0);

const INCLUDE = {
  node:      { select: { id: true, code: true, name_fr: true } },
  move_type: { select: { id: true, code: true, name_fr: true, name_ar: true, operation: true, color: true } },
  lot:       { select: { id: true, lot_number: true, cost_unit: true, expiry_date: true } },
  operator:  { select: { id: true, full_name: true } },
  order:     { select: { id: true } }, // Order has no human-readable reference field — id only for now
  // Emplacement de stockage et BC d'origine (réception : stock_moves.po_item_id)
  location:  {
    select: {
      id: true, label: true, aisle: true, shelf: true,
      zone: { select: { id: true, code: true, name_fr: true } },
      level: { select: { id: true, code: true, name_fr: true } },
    },
  },
  po_item:   { select: { id: true, po: { select: { id: true, reference: true } } } },
  sku: {
    select: {
      id: true, sku_code: true, ean13: true, name_fr: true, name_ar: true,
      images:   { where: { is_primary: true }, take: 1, select: { url: true } },
      category: { select: { id: true, name_fr: true } },
    },
  },
};

const INCLUDE_DETAIL = {
  ...INCLUDE,
  lot: {
    select: {
      id: true, lot_number: true, cost_unit: true, expiry_date: true,
      received_at: true, qty_initial: true, qty_remaining: true,
    },
  },
  sku: {
    select: {
      ...INCLUDE.sku.select,
      sku_family: { select: { id: true, name_fr: true } },
    },
  },
};

const buildWhere = ({ node_id, sku_id, move_type_id, operation, date_from, date_to, search, reference, location_id, po_id } = {}) => {
  const where = {};
  if (node_id)      where.node_id      = node_id;
  if (sku_id)       where.sku_id       = sku_id;
  if (move_type_id) where.move_type_id = move_type_id;
  if (location_id)  where.location_id  = location_id;
  if (po_id)        where.po_item      = { po_id };
  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) where.created_at.gte = new Date(date_from);
    if (date_to) {
      const end = new Date(date_to);
      // date seule (AAAA-MM-JJ) : on inclut toute la journée
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(date_to))) end.setHours(23, 59, 59, 999);
      where.created_at.lte = end;
    }
  }
  if (operation) where.move_type = { operation };
  if (reference) where.reference = { contains: String(reference), mode: 'insensitive' };
  if (search) {
    const q = String(search).trim();
    if (q) {
      where.sku = {
        OR: [
          { sku_code: { contains: q, mode: 'insensitive' } },
          { name_fr:  { contains: q, mode: 'insensitive' } },
          { ean13:    { contains: q } },
        ],
      };
    }
  }
  return where;
};

const findWithFilters = async ({ page = 1, limit = 50, ...filters } = {}) => {
  const where = buildWhere(filters);
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(5000, Math.max(1, Number(limit) || 50));
  const skip = (p - 1) * l;
  const [data, total] = await Promise.all([
    prisma.stockMove.findMany({ where, include: INCLUDE, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], skip, take: l }),
    prisma.stockMove.count({ where }),
  ]);
  return { data, total, page: p, limit: l, pages: Math.ceil(total / l) };
};

// Origine lisible d'un mouvement (append-only : on la déduit des colonnes/metadata)
const sourceOf = (m) => {
  const meta = m.metadata && typeof m.metadata === 'object' ? m.metadata : {};
  if (meta.source === 'stock_count') return { code: 'stock_count', label: 'Comptage physique', reference: meta.session_reference ?? m.reference };
  if (meta.source === 'purchase_order' || m.po_item_id) {
    return {
      code: 'purchase_order',
      label: 'Réception bon de commande',
      reference: m.po_item?.po?.reference ?? meta.po_reference ?? m.reference,
      po_id: m.po_item?.po?.id ?? meta.po_id ?? null,
    };
  }
  if (meta.source) return { code: String(meta.source), label: String(meta.source), reference: m.reference };
  if (m.order_id) return { code: 'order', label: 'Commande', reference: m.order_id.slice(0, 8).toUpperCase() };
  const code = m.move_type?.code;
  if (code === 'reception' || m.lot_id) return { code: 'reception', label: 'Réception marchandises', reference: m.reference };
  if (code === 'adjustment_in' || code === 'adjustment_out') return { code: 'adjustment', label: 'Ajustement manuel', reference: m.reference };
  if (code === 'return_in') return { code: 'return', label: 'Retour client', reference: m.reference };
  return { code: code ?? 'other', label: m.move_type?.name_fr ?? 'Autre', reference: m.reference };
};

const findById = async (id) => {
  const move = await prisma.stockMove.findUnique({ where: { id }, include: INCLUDE_DETAIL });
  if (!move) return null;

  // Solde physique avant / après : metadata si le mouvement l'a enregistré, sinon
  // reconstitué à rebours depuis stock_levels.qty_physical actuel moins les
  // qty_delta des mouvements postérieurs (node × SKU).
  const meta = move.metadata && typeof move.metadata === 'object' ? move.metadata : {};
  let qty_before = null;
  let qty_after = null;
  let balance_source = null;
  if (meta.qty_before !== undefined && meta.qty_after !== undefined) {
    qty_before = N(meta.qty_before);
    qty_after = N(meta.qty_after);
    balance_source = 'metadata';
  } else {
    const [level, later] = await Promise.all([
      prisma.stockLevel.findUnique({
        where: { node_id_sku_id: { node_id: move.node_id, sku_id: move.sku_id } },
        select: { qty_physical: true },
      }),
      prisma.stockMove.aggregate({
        where: {
          node_id: move.node_id,
          sku_id: move.sku_id,
          OR: [
            { created_at: { gt: move.created_at } },
            { created_at: move.created_at, id: { gt: move.id } },
          ],
        },
        _sum: { qty_delta: true },
      }),
    ]);
    if (level) {
      qty_after = Math.round((N(level.qty_physical) - N(later._sum.qty_delta)) * 1000) / 1000;
      qty_before = Math.round((qty_after - N(move.qty_delta)) * 1000) / 1000;
      balance_source = 'reconstitue';
    }
  }

  return { ...move, source: sourceOf(move), qty_before, qty_after, balance_source };
};

const getStats = async (node_id) => {
  const where = node_id ? { node_id } : {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [total, today_count, in_count, out_count] = await Promise.all([
    prisma.stockMove.count({ where }),
    prisma.stockMove.count({ where: { ...where, created_at: { gte: today } } }),
    prisma.stockMove.count({ where: { ...where, move_type: { operation: 'IN'  } } }),
    prisma.stockMove.count({ where: { ...where, move_type: { operation: 'OUT' } } }),
  ]);
  return { total, today_count, in_count, out_count };
};


module.exports = { findWithFilters, findById, getStats, sourceOf };
