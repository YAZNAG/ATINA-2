/**
 * Quelques clients fictifs pour le back-office (liste / fiche).
 * Idempotent : saute la création si le couple indicatif + numéro existe déjà.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function seedDemoCustomers(prisma) {
  const rows = [
    {
      phone_country: '+212',
      phone_number: '650000001',
      name: 'Client démo — Rabat',
      preferred_lang: 'fr',
      referral_code: 'DEMO001RBT',
      city: 'Rabat',
      wallet_balance: 150.5,
      points_balance: 120,
      points_lifetime: 480,
      phone_verified_at: new Date(),
      is_active: true,
      is_deleted: false,
    },
    {
      phone_country: '+212',
      phone_number: '650000002',
      name: 'Client démo — Casablanca',
      preferred_lang: 'ar',
      referral_code: 'DEMO002CSA',
      city: 'Casablanca',
      lat: 33.589886,
      lng: -7.603869,
      wallet_balance: 0,
      points_balance: 40,
      points_lifetime: 40,
      is_active: true,
      is_deleted: false,
    },
    {
      phone_country: '+212',
      phone_number: '650000003',
      name: 'Client démo — bloqué',
      preferred_lang: 'fr',
      referral_code: 'DEMO003BLK',
      city: 'Fès',
      wallet_balance: 12,
      points_balance: 0,
      points_lifetime: 10,
      is_active: false,
      is_deleted: false,
    },
  ];

  let created = 0;
  for (const data of rows) {
    const exists = await prisma.customer.findFirst({
      where: { phone_country: data.phone_country, phone_number: data.phone_number, is_deleted: false },
      select: { id: true },
    });
    if (exists) continue;

    let referred_by_id = null;
    if (data.referral_code === 'DEMO002CSA') {
      const parent = await prisma.customer.findFirst({
        where: { referral_code: 'DEMO001RBT', is_deleted: false },
        select: { id: true },
      });
      referred_by_id = parent?.id ?? null;
    }

    await prisma.customer.create({
      data: {
        ...data,
        referred_by_id,
      },
    });
    created += 1;
  }

  if (created > 0) {
    console.log(`Demo customers: ${created} ligne(s) créée(s) (table customers).`);
  } else {
    console.log('Demo customers: déjà présents — aucune insertion.');
  }
}

module.exports = { seedDemoCustomers };

if (require.main === module) {
  require('dotenv').config();
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  seedDemoCustomers(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
