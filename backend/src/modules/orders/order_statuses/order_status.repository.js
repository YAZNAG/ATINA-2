const prisma = require('../../../config/database');

const buildWhere = ({ search } = {}) =>
  search ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { name_fr: { contains: search, mode: 'insensitive' } }, { name_ar: { contains: search, mode: 'insensitive' } }] } : {};

const findAll = async ({ page = 1, limit = 50, all, ...filters } = {}) => {
  const where = buildWhere(filters);
  if (all === 'true' || all === true) {
    const data = await prisma.orderStatus.findMany({ where, orderBy: { sort_order: 'asc' } });
    return { data, total: data.length };
  }
  const [data, total] = await Promise.all([
    prisma.orderStatus.findMany({ where, skip: (Number(page) - 1) * Number(limit), take: Number(limit), orderBy: { sort_order: 'asc' }, include: { _count: { select: { orders: true } } } }),
    prisma.orderStatus.count({ where }),
  ]);
  return { data, total };
};

const findById   = (id)   => prisma.orderStatus.findUnique({ where: { id }, include: { _count: { select: { orders: true } } } });
const findByCode = (code, excludeId) => prisma.orderStatus.findFirst({ where: { code, ...(excludeId && { NOT: { id: excludeId } }) } });
const create     = (data) => prisma.orderStatus.create({ data });
const update     = (id, data) => prisma.orderStatus.update({ where: { id }, data });
const remove     = (id)   => prisma.orderStatus.delete({ where: { id } });
const countUsage = (id)   => prisma.order.count({ where: { status_id: id } });

const seed = () => prisma.$transaction([
  prisma.orderStatus.upsert({ where: { code: 'pending'        }, update: { color: '#f97316' }, create: { code: 'pending',        name_fr: 'En attente',        name_ar: 'في الانتظار',       color: '#f97316', is_terminal: false, sort_order: 1 } }),
  prisma.orderStatus.upsert({ where: { code: 'confirmed'      }, update: { color: '#3b82f6' }, create: { code: 'confirmed',      name_fr: 'Confirmée',          name_ar: 'مؤكدة',             color: '#3b82f6', is_terminal: false, sort_order: 2 } }),
  prisma.orderStatus.upsert({ where: { code: 'picking'        }, update: { color: '#8b5cf6' }, create: { code: 'picking',        name_fr: 'En préparation',     name_ar: 'قيد التحضير',       color: '#8b5cf6', is_terminal: false, sort_order: 3 } }),
  prisma.orderStatus.upsert({ where: { code: 'ready'          }, update: { color: '#06b6d4' }, create: { code: 'ready',          name_fr: 'Prête',              name_ar: 'جاهزة',             color: '#06b6d4', is_terminal: false, sort_order: 4 } }),
  prisma.orderStatus.upsert({ where: { code: 'in_delivery'    }, update: { color: '#6366f1' }, create: { code: 'in_delivery',    name_fr: 'En livraison',       name_ar: 'قيد التوصيل',       color: '#6366f1', is_terminal: false, sort_order: 5 } }),
  prisma.orderStatus.upsert({ where: { code: 'delivered'      }, update: { color: '#10b981' }, create: { code: 'delivered',      name_fr: 'Livrée',             name_ar: 'تم التوصيل',        color: '#10b981', is_terminal: true,  sort_order: 6 } }),
  prisma.orderStatus.upsert({ where: { code: 'cancelled'      }, update: { color: '#ef4444' }, create: { code: 'cancelled',      name_fr: 'Annulée',            name_ar: 'ملغاة',             color: '#ef4444', is_terminal: true,  sort_order: 7 } }),
  prisma.orderStatus.upsert({ where: { code: 'returned'       }, update: { color: '#64748b' }, create: { code: 'returned',       name_fr: 'Retournée',          name_ar: 'مرتجعة',            color: '#64748b', is_terminal: true,  sort_order: 8 } }),
  prisma.orderStatus.upsert({ where: { code: 'awaiting_stock' }, update: { color: '#eab308' }, create: { code: 'awaiting_stock', name_fr: 'En attente stock',   name_ar: 'في انتظار المخزون', color: '#eab308', is_terminal: false, sort_order: 9 } }),
]);

module.exports = { findAll, findById, findByCode, create, update, remove, countUsage, seed };
