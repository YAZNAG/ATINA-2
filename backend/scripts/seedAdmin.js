const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('123456', 10);

  const role = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: {},
    create: {
      name: 'Administrateur',
      code: 'ADMIN',
    },
  });

  const user = await prisma.user.create({
    data: {
      full_name: 'Admin',
      email: 'admin@test.com',
      password_hash: password,
    },
  });

  await prisma.userRole.create({
    data: {
      user_id: user.id,
      role_id: role.id,
    },
  });

  console.log('✅ Admin créé');
}

main();