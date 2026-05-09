const prisma = require('../../../config/database');

const getAll = () =>
  prisma.stockOperation.findMany({ orderBy: { code: 'asc' } });

const seed = () =>
  prisma.$transaction([
    prisma.stockOperation.upsert({ where: { code: 'IN'      }, update: {}, create: { code: 'IN',      name_fr: 'Entrée',  name_ar: 'دخول'   } }),
    prisma.stockOperation.upsert({ where: { code: 'OUT'     }, update: {}, create: { code: 'OUT',     name_fr: 'Sortie',  name_ar: 'خروج'   } }),
    prisma.stockOperation.upsert({ where: { code: 'NEUTRAL' }, update: {}, create: { code: 'NEUTRAL', name_fr: 'Neutre',  name_ar: 'محايد'  } }),
  ]);

module.exports = { getAll, seed };
