const prisma = require('./src/config/database');

prisma.walletTransaction.findMany({
  orderBy: { created_at: 'desc' },
  take: 3,
})
  .then(r => console.log('Dernières txns wallet:', JSON.stringify(r, null, 2)))
  .catch(e => console.error('Erreur:', e.message))
  .finally(() => prisma.$disconnect());