const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.role.findFirst({ where: { code: 'client' } });

  if (existing) {
    console.log('✅ Rôle client existe déjà');
    return;
  }

  const role = await prisma.role.create({
    data: {
      name: 'Client',
      code: 'client',
      description: 'Rôle par défaut pour les clients de l\'app mobile',
      status: 'active',
      is_active: true,
      is_system: false,
    },
  });

  console.log('✅ Rôle client créé :', role);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());