const prisma = require('../../../config/database');

const buildWhere = ({ search } = {}) =>
  search ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { name_fr: { contains: search, mode: 'insensitive' } }, { name_ar: { contains: search, mode: 'insensitive' } }] } : {};

const findAll = async ({ page = 1, limit = 50, all, ...filters } = {}) => {
  const where = buildWhere(filters);
  if (all === 'true' || all === true) {
    const data = await prisma.orderSlotStatus.findMany({ where, orderBy: { name_fr: 'asc' } });
    return { data, total: data.length };
  }
  const [data, total] = await Promise.all([
    prisma.orderSlotStatus.findMany({ where, skip: (Number(page) - 1) * Number(limit), take: Number(limit), orderBy: { name_fr: 'asc' } }),
    prisma.orderSlotStatus.count({ where }),
  ]);
  return { data, total };
};

const findById   = (id)   => prisma.orderSlotStatus.findUnique({ where: { id } });
const findByCode = (code, excludeId) => prisma.orderSlotStatus.findFirst({ where: { code, ...(excludeId && { NOT: { id: excludeId } }) } });
const create     = (data) => prisma.orderSlotStatus.create({ data });
const update     = (id, data) => prisma.orderSlotStatus.update({ where: { id }, data });
const remove     = (id)   => prisma.orderSlotStatus.delete({ where: { id } });
const countUsage = ()     => Promise.resolve(0);

const seed = () => prisma.$transaction([
  prisma.orderSlotStatus.upsert({ where: { code: 'preferred' }, update: {}, create: { code: 'preferred', name_fr: 'Préféré',  name_ar: 'مفضل',  color: 'blue'   } }),
  prisma.orderSlotStatus.upsert({ where: { code: 'confirmed' }, update: {}, create: { code: 'confirmed', name_fr: 'Confirmé', name_ar: 'مؤكد',   color: 'green'  } }),
  prisma.orderSlotStatus.upsert({ where: { code: 'rejected'  }, update: {}, create: { code: 'rejected',  name_fr: 'Refusé',   name_ar: 'مرفوض',  color: 'red'    } }),
  prisma.orderSlotStatus.upsert({ where: { code: 'expired'   }, update: {}, create: { code: 'expired',   name_fr: 'Expiré',   name_ar: 'منتهي',  color: 'gray'   } }),
]);

module.exports = { findAll, findById, findByCode, create, update, remove, countUsage, seed };
