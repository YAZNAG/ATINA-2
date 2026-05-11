const prisma = require('../../../config/database');

const buildWhere = ({ search } = {}) =>
  search ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { name_fr: { contains: search, mode: 'insensitive' } }, { name_ar: { contains: search, mode: 'insensitive' } }] } : {};

const findAll = async ({ page = 1, limit = 50, all, ...filters } = {}) => {
  const where = buildWhere(filters);
  if (all === 'true' || all === true) {
    const data = await prisma.pickingStatus.findMany({ where, orderBy: { code: 'asc' } });
    return { data, total: data.length };
  }
  const [data, total] = await Promise.all([
    prisma.pickingStatus.findMany({ where, skip: (Number(page)-1)*Number(limit), take: Number(limit), orderBy: { code: 'asc' },
      include: { _count: { select: { sessions: true } } } }),
    prisma.pickingStatus.count({ where }),
  ]);
  return { data, total };
};

const findById   = (id)   => prisma.pickingStatus.findUnique({ where: { id }, include: { _count: { select: { sessions: true } } } });
const findByCode = (code, excludeId) => prisma.pickingStatus.findFirst({ where: { code, ...(excludeId && { NOT: { id: excludeId } }) } });
const create     = (data) => prisma.pickingStatus.create({ data });
const update     = (id, data) => prisma.pickingStatus.update({ where: { id }, data });
const remove     = (id)   => prisma.pickingStatus.delete({ where: { id } });
const countUsage = (id)   => prisma.pickingSession.count({ where: { status_id: id } });

const seed = () => prisma.$transaction([
  prisma.pickingStatus.upsert({ where:{code:'open'},        update:{name_fr:'Ouverte',    name_ar:'مفتوحة'    }, create:{code:'open',        name_fr:'Ouverte',    name_ar:'مفتوحة'    } }),
  prisma.pickingStatus.upsert({ where:{code:'in_progress'}, update:{name_fr:'En cours',   name_ar:'قيد التنفيذ'}, create:{code:'in_progress', name_fr:'En cours',   name_ar:'قيد التنفيذ'} }),
  prisma.pickingStatus.upsert({ where:{code:'completed'},   update:{name_fr:'Terminée',   name_ar:'مكتملة'    }, create:{code:'completed',   name_fr:'Terminée',   name_ar:'مكتملة'    } }),
  prisma.pickingStatus.upsert({ where:{code:'cancelled'},   update:{name_fr:'Annulée',    name_ar:'ملغاة'     }, create:{code:'cancelled',   name_fr:'Annulée',    name_ar:'ملغاة'     } }),
]);

module.exports = { findAll, findById, findByCode, create, update, remove, countUsage, seed };
