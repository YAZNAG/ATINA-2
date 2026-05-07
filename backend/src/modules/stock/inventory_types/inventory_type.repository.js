const prisma = require('../../../config/database');

const buildWhere = ({ search, scope, is_active } = {}) => ({
  ...(scope     && { scope }),
  ...(is_active !== undefined && { is_active: is_active === 'true' || is_active === true }),
  ...(search && {
    OR: [
      { code:    { contains: search, mode: 'insensitive' } },
      { name_fr: { contains: search, mode: 'insensitive' } },
      { name_ar: { contains: search, mode: 'insensitive' } },
    ],
  }),
});

const ORDER = [{ sort_order: 'asc' }, { name_fr: 'asc' }];

const findAll = async ({ page = 1, limit = 20, all, ...filters } = {}) => {
  const where = buildWhere(filters);
  if (all === 'true' || all === true) {
    const data = await prisma.inventoryType.findMany({ where, orderBy: ORDER });
    return { data, total: data.length };
  }
  const pageNum  = Number(page);
  const limitNum = Number(limit);
  const [data, total] = await Promise.all([
    prisma.inventoryType.findMany({ where, skip: (pageNum - 1) * limitNum, take: limitNum, orderBy: ORDER }),
    prisma.inventoryType.count({ where }),
  ]);
  return { data, total };
};

const findById   = (id)          => prisma.inventoryType.findUnique({ where: { id } });
const findByCode = (code, excId) => prisma.inventoryType.findFirst({ where: { code, ...(excId && { NOT: { id: excId } }) } });
const create     = (data)        => prisma.inventoryType.create({ data });
const update     = (id, data)    => prisma.inventoryType.update({ where: { id }, data });
const remove     = (id)          => prisma.inventoryType.delete({ where: { id } });

module.exports = { findAll, findById, findByCode, create, update, remove };
