const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const user = await prisma.user.upsert({
    where: {
      email: 'customer@test.com',
    },
    update: {},
    create: {
      full_name: 'Test Customer',
      email: 'customer@test.com',
      password_hash: passwordHash,
      phone: '+212600000000',
      status: 'active',
      is_active: true,
      is_deleted: false,
      phone_country: '+212',
      phone_number: '600000000',
      phone_verified_at: new Date(),

      // OTP déjà vérifié
      otp_code: null,
      otp_expires_at: null,
    },
  });

  const customer = await prisma.customer.upsert({
    where: {
      user_id: user.id,
    },
    update: {
      phone_verified_at: new Date(),
    },
    create: {
      user_id: user.id,
      name: 'Test Customer',
      phone_country: '+212',
      phone_number: '600000000',
      phone_verified_at: new Date(),
      preferred_lang: 'fr',
      referral_code: 'TESTCUSTOMER01',
      wallet_balance: 0,
      points_balance: 0,
      points_lifetime: 0,
      is_active: true,
      is_deleted: false,
    },
  });

  console.log('User créé :', user);
  console.log('Customer créé :', customer);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });