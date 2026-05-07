const prisma = require('../../../config/database');

const buildWhere = ({ search, is_active, is_sellable } = {}) => ({
  ...(is_active   !== undefined && { is_active:   is_active   === 'true' || is_active   === true }),
  ...(is_sellable !== undefined && { is_sellable: is_sellable === 'true' || is_sellable === true }),
  ...(search && {
    OR: [
      { code:    { contains: search, mode: 'insensitive' } },
      { name_fr: { contains: search, mode: 'insensitive' } },
      { name_ar: { contains: search, mode: 'insensitive' } },
    ],
  }),
});

const findAll = async ({ page = 1, limit = 20, all, ...filters } = {}) => {
  const where = buildWhere(filters);
  if (all === 'true' || all === true) {
    const data = await prisma.stockStatus.findMany({ where, orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }] });
    return { data, total: data.length };
  }
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const [data, total] = await Promise.all([
    prisma.stockStatus.findMany({ where, skip: (pageNum - 1) * limitNum, take: limitNum, orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }] }),
    prisma.stockStatus.count({ where }),
  ]);
  return { data, total };
};

const findById   = (id)           => prisma.stockStatus.findUnique({ where: { id } });
const findByCode = (code, excId)  => prisma.stockStatus.findFirst({ where: { code, ...(excId && { NOT: { id: excId } }) } });
const create     = (data)         => prisma.stockStatus.create({ data });
const update     = (id, data)     => prisma.stockStatus.update({ where: { id }, data });
const remove     = (id)           => prisma.stockStatus.delete({ where: { id } });

module.exports = { findAll, findById, findByCode, create, update, remove };
