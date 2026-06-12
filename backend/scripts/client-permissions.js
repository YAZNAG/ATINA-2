const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  // Trouve le rôle client
  const clientRole = await prisma.role.findFirst({ where: { code: 'client' } });
  if (!clientRole) throw new Error('Rôle client introuvable');

  // Permissions catalog nécessaires pour l'app mobile
  const permissionCodes = [
    'categories.view',
    'families.view',
    'articles.view',
    'skus.view',
    'sku_images.view',
    'article_images.manage',
    'brands.view',
    'units.view',
  ];

  for (const code of permissionCodes) {
    const permission = await prisma.permission.findFirst({ where: { code } });
    if (!permission) {
      console.log(`⚠️  Permission introuvable : ${code}`);
      continue;
    }

    // Vérifie si déjà assignée
    const existing = await prisma.rolePermission.findFirst({
      where: { role_id: clientRole.id, permission_id: permission.id },
    });

    if (existing) {
      console.log(`✅ Déjà assignée : ${code}`);
      continue;
    }

    await prisma.rolePermission.create({
      data: { role_id: clientRole.id, permission_id: permission.id },
    });
    console.log(`✅ Ajoutée : ${code}`);
  }

  console.log('\n🎉 Permissions catalog ajoutées au rôle client !');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());