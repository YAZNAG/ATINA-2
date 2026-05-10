const prisma = require('../../../config/database');

const buildWhere = ({ search, is_active } = {}) => ({
  ...(is_active !== undefined && { is_active: is_active === 'true' || is_active === true }),
  ...(search && { OR: [{ code: { contains: search, mode: 'insensitive' } }, { name_fr: { contains: search, mode: 'insensitive' } }, { name_ar: { contains: search, mode: 'insensitive' } }] }),
});

const findAll = async ({ page = 1, limit = 50, all, ...filters } = {}) => {
  const where = buildWhere(filters);
  if (all === 'true' || all === true) {
    const data = await prisma.paymentMethod.findMany({ where, orderBy: { name_fr: 'asc' } });
    return { data, total: data.length };
  }
  const [data, total] = await Promise.all([
    prisma.paymentMethod.findMany({ where, skip: (Number(page) - 1) * Number(limit), take: Number(limit), orderBy: { name_fr: 'asc' }, include: { _count: { select: { payments: true } } } }),
    prisma.paymentMethod.count({ where }),
  ]);
  return { data, total };
};

const findById      = (id)   => prisma.paymentMethod.findUnique({ where: { id }, include: { _count: { select: { payments: true } } } });
const findByCode    = (code, excludeId) => prisma.paymentMethod.findFirst({ where: { code, ...(excludeId && { NOT: { id: excludeId } }) } });
const create        = (data) => prisma.paymentMethod.create({ data });
const update        = (id, data) => prisma.paymentMethod.update({ where: { id }, data });
const remove        = (id)   => prisma.paymentMethod.delete({ where: { id } });
const countUsage    = (id)   => prisma.payment.count({ where: { payment_method_id: id } });
const countActive   = ()     => prisma.paymentMethod.count({ where: { is_active: true } });

const seed = () => prisma.$transaction([
  prisma.paymentMethod.upsert({ where: { code: 'cod'    }, update: {}, create: { code: 'cod',    name_fr: 'Paiement à la livraison', name_ar: 'الدفع عند التسليم', is_active: true  } }),
  prisma.paymentMethod.upsert({ where: { code: 'wallet' }, update: {}, create: { code: 'wallet', name_fr: 'Wallet',                  name_ar: 'المحفظة',           is_active: false } }),
  prisma.paymentMethod.upsert({ where: { code: 'mixed'  }, update: {}, create: { code: 'mixed',  name_fr: 'Paiement mixte',          name_ar: 'دفع مختلط',         is_active: false } }),
]);

module.exports = { findAll, findById, findByCode, create, update, remove, countUsage, countActive, seed };
