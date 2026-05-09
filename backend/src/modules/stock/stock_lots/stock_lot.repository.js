const prisma = require('../../../config/database');

const INCLUDE = {
  node: { select: { id: true, code: true, name_fr: true } },
  sku: {
    select: {
      id: true,
      images: { where: { is_primary: true }, take: 1, select: { url: true } },
      article: {
        select: {
          id: true, name_fr: true, name_ar: true, sku_code: true, ean13: true,
          category: { select: { id: true, name_fr: true } },
        },
      },
    },
  },
};

const findWithFilters = async ({
  node_id, sku_id, expiring_soon, expired, exhausted, active,
} = {}) => {
  const where = { is_deleted: false };
  if (node_id) where.node_id = node_id;
  if (sku_id)  where.sku_id  = sku_id;

  const now = new Date();
  if (expired === 'true' || expired === true) {
    where.expiry_date = { lt: now, not: null };
  } else if (expiring_soon === 'true' || expiring_soon === true) {
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    where.expiry_date = { gte: now, lte: soon };
  }
  if (exhausted === 'true' || exhausted === true)
    where.qty_remaining = { lte: 0 };
  if (active === 'true' || active === true)
    where.qty_remaining = { gt: 0 };

  return prisma.stockLot.findMany({
    where,
    include: INCLUDE,
    orderBy: { received_at: 'asc' },
  });
};

const findById = (id) =>
  prisma.stockLot.findUnique({ where: { id }, include: INCLUDE });

// FIFO: consume qty from oldest lots first, returns list of { lot_id, consumed }
const fifoConsume = async (tx, node_id, sku_id, qty_to_consume) => {
  const now = new Date();
  const lots = await tx.stockLot.findMany({
    where: {
      node_id,
      sku_id,
      is_deleted: false,
      qty_remaining: { gt: 0 },
      OR: [
        { expiry_date: null },
        { expiry_date: { gte: now } },
      ],
    },
    orderBy: { received_at: 'asc' },
  });

  let remaining = qty_to_consume;
  const consumed = [];

  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(lot.qty_remaining));
    await tx.stockLot.update({
      where: { id: lot.id },
      data:  { qty_remaining: { decrement: take } },
    });
    consumed.push({ lot_id: lot.id, consumed: take, cost_unit: Number(lot.cost_unit) });
    remaining -= take;
  }

  return { consumed, unmet: remaining };
};

// Create lot on receipt
const createLot = (data) =>
  prisma.stockLot.create({ data, include: INCLUDE });

// Soft delete
const softDelete = async (id) =>
  prisma.stockLot.update({
    where: { id },
    data:  { is_deleted: true, deleted_at: new Date() },
  });

const getAlerts = async (node_id) => {
  const where = { is_deleted: false };
  if (node_id) where.node_id = node_id;
  const now   = new Date();
  const soon  = new Date(); soon.setDate(soon.getDate() + 30);

  const [expired, expiring_soon, exhausted] = await Promise.all([
    prisma.stockLot.count({ where: { ...where, expiry_date: { lt: now, not: null } } }),
    prisma.stockLot.count({ where: { ...where, expiry_date: { gte: now, lte: soon } } }),
    prisma.stockLot.count({ where: { ...where, qty_remaining: { lte: 0 } } }),
  ]);
  return { expired, expiring_soon, exhausted };
};

module.exports = { findWithFilters, findById, fifoConsume, createLot, softDelete, getAlerts };
