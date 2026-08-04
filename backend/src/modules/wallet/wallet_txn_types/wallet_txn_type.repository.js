const prisma = require('../../../config/database');

const VALID_DIRS = ['IN', 'OUT'];

const buildWhere = ({ search, direction } = {}) => ({
  ...(direction && VALID_DIRS.includes(direction.toUpperCase()) && { direction: direction.toUpperCase() }),
  ...(search && { OR: [{ code: { contains: search, mode: 'insensitive' } }, { name_fr: { contains: search, mode: 'insensitive' } }, { name_ar: { contains: search, mode: 'insensitive' } }] }),
});

const findAll = async ({ page = 1, limit = 50, all, ...filters } = {}) => {
  const where = buildWhere(filters);
  if (all === 'true' || all === true) {
    const data = await prisma.walletTxnType.findMany({ where, orderBy: { name_fr: 'asc' } });
    return { data, total: data.length };
  }
  const [data, total] = await Promise.all([
    prisma.walletTxnType.findMany({ where, skip: (Number(page) - 1) * Number(limit), take: Number(limit), orderBy: [{ direction: 'asc' }, { name_fr: 'asc' }] }),
    prisma.walletTxnType.count({ where }),
  ]);
  return { data, total };
};

const findById   = (id)   => prisma.walletTxnType.findUnique({ where: { id } });
const findByCode = (code, excludeId) => prisma.walletTxnType.findFirst({ where: { code, ...(excludeId && { NOT: { id: excludeId } }) } });
const create     = (data) => prisma.walletTxnType.create({ data });
const update     = (id, data) => prisma.walletTxnType.update({ where: { id }, data });
const remove     = (id)   => prisma.walletTxnType.delete({ where: { id } });

const seed = () => prisma.$transaction([
  prisma.walletTxnType.upsert({ where: { code: 'DEBIT_PURCHASE'    }, update: {}, create: { code: 'DEBIT_PURCHASE',    name_fr: 'Paiement commande',      name_ar: 'دفع الطلب',          direction: 'OUT' } }),
  prisma.walletTxnType.upsert({ where: { code: 'CREDIT_REFUND'     }, update: {}, create: { code: 'CREDIT_REFUND',     name_fr: 'Remboursement',          name_ar: 'استرجاع',            direction: 'IN'  } }),
  prisma.walletTxnType.upsert({ where: { code: 'CREDIT_REFERRAL'   }, update: {}, create: { code: 'CREDIT_REFERRAL',   name_fr: 'Récompense parrainage',  name_ar: 'مكافأة الإحالة',     direction: 'IN'  } }),
  prisma.walletTxnType.upsert({ where: { code: 'CREDIT_PROMO'      }, update: {}, create: { code: 'CREDIT_PROMO',      name_fr: 'Crédit promotionnel',    name_ar: 'رصيد ترويجي',        direction: 'IN'  } }),
  prisma.walletTxnType.upsert({ where: { code: 'CREDIT_PRIZE'      }, update: {}, create: { code: 'CREDIT_PRIZE',      name_fr: 'Gain jeu',               name_ar: 'جائزة اللعبة',       direction: 'IN'  } }),
  prisma.walletTxnType.upsert({ where: { code: 'CREDIT_ADMIN'      }, update: {}, create: { code: 'CREDIT_ADMIN',      name_fr: 'Ajustement crédit admin', name_ar: 'تعديل رصيد إداري',  direction: 'IN'  } }),
  prisma.walletTxnType.upsert({ where: { code: 'DEBIT_ADMIN'       }, update: {}, create: { code: 'DEBIT_ADMIN',       name_fr: 'Débit admin',            name_ar: 'خصم إداري',          direction: 'OUT' } }),
  prisma.walletTxnType.upsert({ where: { code: 'DEBIT_EXPIRY'      }, update: {}, create: { code: 'DEBIT_EXPIRY',      name_fr: 'Expiration du solde',    name_ar: 'انتهاء الرصيد',      direction: 'OUT' } }),
  prisma.walletTxnType.upsert({ where: { code: 'CREDIT_ORDER'      }, update: {}, create: { code: 'CREDIT_ORDER',      name_fr: 'Crédit remboursement co...', name_ar: 'رصيد استرداد الطلب', direction: 'IN'  } }),
]);

module.exports = { findAll, findById, findByCode, create, update, remove, seed, VALID_DIRS };
