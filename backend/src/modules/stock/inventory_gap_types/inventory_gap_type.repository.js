const prisma = require('../../../config/database');

const ALLOWED_IMPACTS = ['POSITIVE', 'NEGATIVE', 'NEUTRAL'];

const buildWhere = ({ search, impact_stock, is_active, requires_validation } = {}) => ({
  ...(impact_stock       && ALLOWED_IMPACTS.includes(impact_stock) && { impact_stock }),
  ...(is_active          !== undefined && { is_active:           is_active           === 'true' || is_active           === true }),
  ...(requires_validation !== undefined && { requires_validation: requires_validation === 'true' || requires_validation === true }),
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
    const data = await prisma.inventoryGapType.findMany({ where, orderBy: ORDER });
    return { data, total: data.length };
  }
  const pageNum  = Number(page);
  const limitNum = Number(limit);
  const [data, total] = await Promise.all([
    prisma.inventoryGapType.findMany({ where, skip: (pageNum - 1) * limitNum, take: limitNum, orderBy: ORDER }),
    prisma.inventoryGapType.count({ where }),
  ]);
  return { data, total };
};

const findById   = (id)          => prisma.inventoryGapType.findUnique({ where: { id } });
const findByCode = (code, excId) => prisma.inventoryGapType.findFirst({ where: { code, ...(excId && { NOT: { id: excId } }) } });
const create     = (data)        => prisma.inventoryGapType.create({ data });
const update     = (id, data)    => prisma.inventoryGapType.update({ where: { id }, data });
const remove     = (id)          => prisma.inventoryGapType.delete({ where: { id } });

module.exports = { findAll, findById, findByCode, create, update, remove, ALLOWED_IMPACTS };
