const prisma = require('../../../config/database');

const INCLUDE = {
  node:      { select: { id: true, code: true, name_fr: true } },
  move_type: { select: { id: true, code: true, name_fr: true, name_ar: true, operation: true, color: true } },
  lot:       { select: { id: true, lot_number: true, cost_unit: true, expiry_date: true } },
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
  node_id, sku_id, move_type_id, operation,
  date_from, date_to,
  page = 1, limit = 50,
} = {}) => {
  const where = {};
  if (node_id)      where.node_id      = node_id;
  if (sku_id)       where.sku_id       = sku_id;
  if (move_type_id) where.move_type_id = move_type_id;
  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) where.created_at.gte = new Date(date_from);
    if (date_to)   where.created_at.lte = new Date(date_to);
  }
  if (operation) {
    where.move_type = { operation };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    prisma.stockMove.findMany({ where, include: INCLUDE, orderBy: { created_at: 'desc' }, skip, take: Number(limit) }),
    prisma.stockMove.count({ where }),
  ]);
  return { data, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) };
};

const findById = (id) =>
  prisma.stockMove.findUnique({ where: { id }, include: INCLUDE });

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

module.exports = { findWithFilters, findById, getStats };
