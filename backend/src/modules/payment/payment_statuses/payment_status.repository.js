const prisma = require('../../../config/database');

const buildWhere = ({ search } = {}) =>
  search ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { name_fr: { contains: search, mode: 'insensitive' } }, { name_ar: { contains: search, mode: 'insensitive' } }] } : {};

const findAll = async ({ page = 1, limit = 50, all, ...filters } = {}) => {
  const where = buildWhere(filters);
  if (all === 'true' || all === true) {
    const data = await prisma.paymentStatus.findMany({ where, orderBy: { name_fr: 'asc' } });
    return { data, total: data.length };
  }
  const [data, total] = await Promise.all([
    prisma.paymentStatus.findMany({ where, skip: (Number(page) - 1) * Number(limit), take: Number(limit), orderBy: { name_fr: 'asc' }, include: { _count: { select: { payments: true } } } }),
    prisma.paymentStatus.count({ where }),
  ]);
  return { data, total };
};

const findById   = (id)   => prisma.paymentStatus.findUnique({ where: { id }, include: { _count: { select: { payments: true } } } });
const findByCode = (code, excludeId) => prisma.paymentStatus.findFirst({ where: { code, ...(excludeId && { NOT: { id: excludeId } }) } });
const create     = (data) => prisma.paymentStatus.create({ data });
const update     = (id, data) => prisma.paymentStatus.update({ where: { id }, data });
const remove     = (id)   => prisma.paymentStatus.delete({ where: { id } });
const countUsage = (id)   => prisma.payment.count({ where: { status_id: id } });

const seed = () => prisma.$transaction([
  prisma.paymentStatus.upsert({ where: { code: 'pending'   }, update: {}, create: { code: 'pending',   name_fr: 'En attente',  name_ar: 'في الانتظار' } }),
  prisma.paymentStatus.upsert({ where: { code: 'collected' }, update: {}, create: { code: 'collected', name_fr: 'Collecté',    name_ar: 'محصل'        } }),
  prisma.paymentStatus.upsert({ where: { code: 'failed'    }, update: {}, create: { code: 'failed',    name_fr: 'Échec',       name_ar: 'فشل'         } }),
  prisma.paymentStatus.upsert({ where: { code: 'refunded'  }, update: {}, create: { code: 'refunded',  name_fr: 'Remboursé',   name_ar: 'مسترجع'      } }),
]);

module.exports = { findAll, findById, findByCode, create, update, remove, countUsage, seed };
