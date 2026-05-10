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
  prisma.walletTxnType.upsert({ where: { code: 'order_payment'     }, update: {}, create: { code: 'order_payment',     name_fr: 'Paiement commande',      name_ar: 'دفع الطلب',          direction: 'OUT' } }),
  prisma.walletTxnType.upsert({ where: { code: 'refund'            }, update: {}, create: { code: 'refund',            name_fr: 'Remboursement',          name_ar: 'استرجاع',            direction: 'IN'  } }),
  prisma.walletTxnType.upsert({ where: { code: 'referral_reward'   }, update: {}, create: { code: 'referral_reward',   name_fr: 'Récompense parrainage',  name_ar: 'مكافأة الإحالة',     direction: 'IN'  } }),
  prisma.walletTxnType.upsert({ where: { code: 'promo_credit'      }, update: {}, create: { code: 'promo_credit',      name_fr: 'Crédit promotionnel',    name_ar: 'رصيد ترويجي',        direction: 'IN'  } }),
  prisma.walletTxnType.upsert({ where: { code: 'prize_award'       }, update: {}, create: { code: 'prize_award',       name_fr: 'Gain jeu',               name_ar: 'جائزة اللعبة',       direction: 'IN'  } }),
  prisma.walletTxnType.upsert({ where: { code: 'manual_adjustment' }, update: {}, create: { code: 'manual_adjustment', name_fr: 'Ajustement manuel',      name_ar: 'تعديل يدوي',         direction: 'IN'  } }),
  prisma.walletTxnType.upsert({ where: { code: 'expiry'            }, update: {}, create: { code: 'expiry',            name_fr: 'Expiration solde',       name_ar: 'انتهاء الرصيد',      direction: 'OUT' } }),
]);

module.exports = { findAll, findById, findByCode, create, update, remove, seed, VALID_DIRS };
