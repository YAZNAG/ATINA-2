const prisma = require('../../../config/database');

const INCLUDE = {
  node_type: true,
  region: true,
  city: true,
};

// Statuts de commande terminaux : une commande dans l'un de ces statuts n'est plus « active ».
const TERMINAL_ORDER_STATUSES = ['delivered', 'cancelled', 'returned'];

const bool = (v) => v === 'true' || v === true;

const buildWhere = ({ search, is_active, is_deleted, node_type_id, region_id, city_id }) => ({
  ...(is_deleted !== undefined && is_deleted !== ''
    ? { is_deleted: bool(is_deleted) }
    : { is_deleted: false }),
  ...(is_active !== undefined && is_active !== '' && { is_active: bool(is_active) }),
  ...(node_type_id && { node_type_id }),
  ...(region_id && { region_id }),
  ...(city_id && { city_id }),
  ...(search && {
    OR: [
      { code: { contains: search, mode: 'insensitive' } },
      { name_fr: { contains: search, mode: 'insensitive' } },
      { name_ar: { contains: search, mode: 'insensitive' } },
    ],
  }),
});

const findAll = async (params) => {
  const { page = 1, limit = 20, ...filters } = params;
  const where = buildWhere(filters);
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 20);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.node.findMany({ where, skip, take: limitNum, include: INCLUDE, orderBy: [{ created_at: 'desc' }] }),
    prisma.node.count({ where }),
  ]);
  return { data, total };
};

const findById = (id) => prisma.node.findFirst({ where: { id, is_deleted: false }, include: INCLUDE });
// Consultation (historique conservé) : un node supprimé reste consultable.
const findByIdWithDeleted = (id) => prisma.node.findFirst({ where: { id }, include: INCLUDE });
const findByCode = (code, excludeId) =>
  prisma.node.findFirst({ where: { code, ...(excludeId && { NOT: { id: excludeId } }) } });
const create = (data) => prisma.node.create({ data, include: INCLUDE });
const update = (id, data) => prisma.node.update({ where: { id }, data, include: INCLUDE });
const softDelete = (id) =>
  prisma.node.update({
    where: { id },
    data: { is_deleted: true, is_active: false, deleted_at: new Date() },
    include: INCLUDE,
  });

/** Commandes non terminées rattachées au node. */
const countActiveOrders = (nodeId) =>
  prisma.order.count({
    where: {
      node_id: nodeId,
      status: { code: { notIn: TERMINAL_ORDER_STATUSES }, is_terminal: false },
    },
  });

/** Lignes de stock encore actives (physique ou réservé > 0). */
const countActiveStock = (nodeId) =>
  prisma.stockLevel.count({
    where: {
      node_id: nodeId,
      OR: [{ qty_physical: { gt: 0 } }, { qty_reserved: { gt: 0 } }],
    },
  });

module.exports = {
  findAll,
  findById,
  findByIdWithDeleted,
  findByCode,
  create,
  update,
  softDelete,
  countActiveOrders,
  countActiveStock,
};
