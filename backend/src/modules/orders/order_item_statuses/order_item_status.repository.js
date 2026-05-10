const prisma = require('../../../config/database');

const buildWhere = ({ search } = {}) =>
  search ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { name_fr: { contains: search, mode: 'insensitive' } }, { name_ar: { contains: search, mode: 'insensitive' } }] } : {};

const findAll = async ({ page = 1, limit = 50, all, ...filters } = {}) => {
  const where = buildWhere(filters);
  if (all === 'true' || all === true) {
    const data = await prisma.orderItemStatus.findMany({ where, orderBy: { name_fr: 'asc' } });
    return { data, total: data.length };
  }
  const [data, total] = await Promise.all([
    prisma.orderItemStatus.findMany({ where, skip: (Number(page) - 1) * Number(limit), take: Number(limit), orderBy: { name_fr: 'asc' }, include: { _count: { select: { order_items: true } } } }),
    prisma.orderItemStatus.count({ where }),
  ]);
  return { data, total };
};

const findById   = (id)   => prisma.orderItemStatus.findUnique({ where: { id }, include: { _count: { select: { order_items: true } } } });
const findByCode = (code, excludeId) => prisma.orderItemStatus.findFirst({ where: { code, ...(excludeId && { NOT: { id: excludeId } }) } });
const create     = (data) => prisma.orderItemStatus.create({ data });
const update     = (id, data) => prisma.orderItemStatus.update({ where: { id }, data });
const remove     = (id)   => prisma.orderItemStatus.delete({ where: { id } });
const countUsage = (id)   => prisma.orderItem.count({ where: { status_id: id } });

const seed = () => prisma.$transaction([
  prisma.orderItemStatus.upsert({ where: { code: 'active'       }, update: {}, create: { code: 'active',       name_fr: 'Active',         name_ar: 'نشط',           color: 'green'  } }),
  prisma.orderItemStatus.upsert({ where: { code: 'cancelled'    }, update: {}, create: { code: 'cancelled',    name_fr: 'Annulé',          name_ar: 'ملغى',          color: 'red'    } }),
  prisma.orderItemStatus.upsert({ where: { code: 'substituted'  }, update: {}, create: { code: 'substituted',  name_fr: 'Remplacé',        name_ar: 'مستبدل',        color: 'blue'   } }),
  prisma.orderItemStatus.upsert({ where: { code: 'out_of_stock' }, update: {}, create: { code: 'out_of_stock', name_fr: 'Rupture stock',   name_ar: 'نفاد المخزون', color: 'orange' } }),
]);

module.exports = { findAll, findById, findByCode, create, update, remove, countUsage, seed };
