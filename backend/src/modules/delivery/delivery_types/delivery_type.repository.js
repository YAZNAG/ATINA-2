const prisma = require('../../../config/database');

const buildWhere = ({ search } = {}) =>
  search
    ? {
        OR: [
          { code:    { contains: search, mode: 'insensitive' } },
          { name_fr: { contains: search, mode: 'insensitive' } },
          { name_ar: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

const findAll = async ({ page = 1, limit = 50, all, ...filters } = {}) => {
  const where = buildWhere(filters);
  if (all === 'true' || all === true) {
    const data = await prisma.deliveryType.findMany({ where, orderBy: { name_fr: 'asc' } });
    return { data, total: data.length };
  }
  const pageNum  = Number(page);
  const limitNum = Number(limit);
  const [data, total] = await Promise.all([
    prisma.deliveryType.findMany({
      where,
      skip:    (pageNum - 1) * limitNum,
      take:    limitNum,
      orderBy: { name_fr: 'asc' },
      include: { _count: { select: { orders: true } } },
    }),
    prisma.deliveryType.count({ where }),
  ]);
  return { data, total };
};

const findById   = (id)   => prisma.deliveryType.findUnique({ where: { id }, include: { _count: { select: { orders: true } } } });
const findByCode = (code, excludeId) =>
  prisma.deliveryType.findFirst({ where: { code, ...(excludeId && { NOT: { id: excludeId } }) } });

const create = (data)       => prisma.deliveryType.create({ data });
const update = (id, data)   => prisma.deliveryType.update({ where: { id }, data });
const remove = (id)         => prisma.deliveryType.delete({ where: { id } });

const countOrders = (id) => prisma.order.count({ where: { delivery_type_id: id } });

const seed = () =>
  prisma.$transaction([
    prisma.deliveryType.upsert({
      where:  { code: 'home' },
      update: {},
      create: { code: 'home', name_fr: 'Livraison à domicile', name_ar: 'التوصيل إلى المنزل' },
    }),
    prisma.deliveryType.upsert({
      where:  { code: 'pickup' },
      update: {},
      create: { code: 'pickup', name_fr: 'Retrait magasin', name_ar: 'الاستلام من المتجر' },
    }),
  ]);

module.exports = { findAll, findById, findByCode, create, update, remove, countOrders, seed };
