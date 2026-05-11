const prisma = require('../../../config/database');

const buildWhere = ({ search } = {}) =>
  search ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { name_fr: { contains: search, mode: 'insensitive' } }, { name_ar: { contains: search, mode: 'insensitive' } }] } : {};

const findAll = async ({ page = 1, limit = 50, all, ...filters } = {}) => {
  const where = buildWhere(filters);
  if (all === 'true' || all === true) {
    const data = await prisma.pickItemStatus.findMany({ where, orderBy: { code: 'asc' } });
    return { data, total: data.length };
  }
  const [data, total] = await Promise.all([
    prisma.pickItemStatus.findMany({ where, skip: (Number(page)-1)*Number(limit), take: Number(limit), orderBy: { code: 'asc' },
      include: { _count: { select: { session_items: true } } } }),
    prisma.pickItemStatus.count({ where }),
  ]);
  return { data, total };
};

const findById   = (id)   => prisma.pickItemStatus.findUnique({ where: { id }, include: { _count: { select: { session_items: true } } } });
const findByCode = (code, excludeId) => prisma.pickItemStatus.findFirst({ where: { code, ...(excludeId && { NOT: { id: excludeId } }) } });
const create     = (data) => prisma.pickItemStatus.create({ data });
const update     = (id, data) => prisma.pickItemStatus.update({ where: { id }, data });
const remove     = (id)   => prisma.pickItemStatus.delete({ where: { id } });
const countUsage = (id)   => prisma.pickingSessionItem.count({ where: { status_id: id } });

const seed = () => prisma.$transaction([
  prisma.pickItemStatus.upsert({ where:{code:'pending'},      update:{name_fr:'En attente',   name_ar:'في الانتظار'  }, create:{code:'pending',      name_fr:'En attente',   name_ar:'في الانتظار'  } }),
  prisma.pickItemStatus.upsert({ where:{code:'picked'},       update:{name_fr:'Préparé',      name_ar:'تم التحضير'  }, create:{code:'picked',       name_fr:'Préparé',      name_ar:'تم التحضير'  } }),
  prisma.pickItemStatus.upsert({ where:{code:'substituted'},  update:{name_fr:'Remplacé',     name_ar:'مستبدل'      }, create:{code:'substituted',  name_fr:'Remplacé',     name_ar:'مستبدل'      } }),
  prisma.pickItemStatus.upsert({ where:{code:'out_of_stock'}, update:{name_fr:'Rupture stock',name_ar:'نفاد المخزون'}, create:{code:'out_of_stock', name_fr:'Rupture stock',name_ar:'نفاد المخزون'} }),
]);

module.exports = { findAll, findById, findByCode, create, update, remove, countUsage, seed };
