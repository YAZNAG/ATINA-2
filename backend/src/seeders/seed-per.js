// prisma/seeds/permissions-geographic-crud.seed.js
// Usage : node prisma/seeds/permissions-geographic-crud.seed.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const permissions = [
  // =========================
  // CITIES
  // =========================
  {
    code: 'cities.create',
    name: 'Create cities',
    name_fr: 'Créer une ville',
    name_ar: 'إنشاء مدينة',
    module: 'cities',
    action: 'create',
    description: 'Créer une nouvelle ville',
  },
  {
    code: 'cities.update',
    name: 'Update cities',
    name_fr: 'Modifier une ville',
    name_ar: 'تعديل مدينة',
    module: 'cities',
    action: 'update',
    description: 'Modifier une ville existante',
  },
  {
    code: 'cities.delete',
    name: 'Delete cities',
    name_fr: 'Supprimer une ville',
    name_ar: 'حذف مدينة',
    module: 'cities',
    action: 'delete',
    description: 'Supprimer (soft delete) une ville',
  },

  // =========================
  // PROVINCES
  // =========================
  {
    code: 'provinces.create',
    name: 'Create provinces',
    name_fr: 'Créer une province',
    name_ar: 'إنشاء إقليم',
    module: 'provinces',
    action: 'create',
    description: 'Créer une nouvelle province',
  },
  {
    code: 'provinces.update',
    name: 'Update provinces',
    name_fr: 'Modifier une province',
    name_ar: 'تعديل إقليم',
    module: 'provinces',
    action: 'update',
    description: 'Modifier une province existante',
  },
  {
    code: 'provinces.delete',
    name: 'Delete provinces',
    name_fr: 'Supprimer une province',
    name_ar: 'حذف إقليم',
    module: 'provinces',
    action: 'delete',
    description: 'Supprimer (soft delete) une province',
  },

  // =========================
  // REGIONS
  // =========================
  {
    code: 'regions.create',
    name: 'Create regions',
    name_fr: 'Créer une région',
    name_ar: 'إنشاء جهة',
    module: 'regions',
    action: 'create',
    description: 'Créer une nouvelle région',
  },
  {
    code: 'regions.update',
    name: 'Update regions',
    name_fr: 'Modifier une région',
    name_ar: 'تعديل جهة',
    module: 'regions',
    action: 'update',
    description: 'Modifier une région existante',
  },
  {
    code: 'regions.delete',
    name: 'Delete regions',
    name_fr: 'Supprimer une région',
    name_ar: 'حذف جهة',
    module: 'regions',
    action: 'delete',
    description: 'Supprimer (soft delete) une région',
  },
];

async function main() {
  for (const perm of permissions) {
    const row = await prisma.permission.upsert({
      where: { code: perm.code },
      update: perm,
      create: perm,
    });

    console.log(`OK: ${row.code}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());