const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// ── ROLES ─────────────────────────────────────────────────────────────────────
const ROLES = [
  { code: 'superadmin',       name: 'Super Admin',      name_fr: 'Super Administrateur', name_ar: 'مدير عام',           is_system: true,  is_active: true },
  { code: 'backoffice_admin', name: 'Backoffice Admin', name_fr: 'Administrateur BO',    name_ar: 'مدير الواجهة',       is_system: true,  is_active: true },
  { code: 'manager_node',     name: 'Manager Node',     name_fr: 'Responsable Node',     name_ar: 'مسؤول النود',        is_system: false, is_active: true },
  { code: 'picker',           name: 'Picker',           name_fr: 'Préparateur commande', name_ar: 'محضر الطلبات',       is_system: false, is_active: true },
  { code: 'driver',           name: 'Driver',           name_fr: 'Livreur',              name_ar: 'سائق',               is_system: false, is_active: true },
  { code: 'customer',         name: 'Customer',         name_fr: 'Client',               name_ar: 'عميل',               is_system: false, is_active: true },
];

// ── PERMISSIONS ───────────────────────────────────────────────────────────────
const PERMISSIONS = [
  // Dashboard
  { code: 'dashboard.view',        module: 'dashboard',   action: 'read',   name: 'Voir tableau de bord',      name_fr: 'Voir tableau de bord',       name_ar: 'عرض لوحة التحكم' },

  // Users
  { code: 'users.view',            module: 'users',       action: 'read',   name: 'Lire utilisateurs',         name_fr: 'Lire utilisateurs',          name_ar: 'قراءة المستخدمين' },
  { code: 'users.create',          module: 'users',       action: 'create', name: 'Créer utilisateur',         name_fr: 'Créer utilisateur',          name_ar: 'إنشاء مستخدم' },
  { code: 'users.update',          module: 'users',       action: 'update', name: 'Modifier utilisateur',      name_fr: 'Modifier utilisateur',       name_ar: 'تعديل مستخدم' },
  { code: 'users.delete',          module: 'users',       action: 'delete', name: 'Supprimer utilisateur',     name_fr: 'Supprimer utilisateur',      name_ar: 'حذف مستخدم' },

  // Roles
  { code: 'roles.view',            module: 'roles',       action: 'read',   name: 'Lire rôles',                name_fr: 'Lire rôles',                 name_ar: 'قراءة الأدوار' },
  { code: 'roles.create',          module: 'roles',       action: 'create', name: 'Créer rôle',                name_fr: 'Créer rôle',                 name_ar: 'إنشاء دور' },
  { code: 'roles.update',          module: 'roles',       action: 'update', name: 'Modifier rôle',             name_fr: 'Modifier rôle',              name_ar: 'تعديل دور' },
  { code: 'roles.delete',          module: 'roles',       action: 'delete', name: 'Supprimer rôle',            name_fr: 'Supprimer rôle',             name_ar: 'حذف دور' },

  // Permissions
  { code: 'permissions.view',      module: 'permissions', action: 'read',   name: 'Lire permissions',          name_fr: 'Lire permissions',           name_ar: 'قراءة الصلاحيات' },
  { code: 'permissions.assign',    module: 'permissions', action: 'assign', name: 'Assigner permissions',      name_fr: 'Assigner permissions',       name_ar: 'تعيين الصلاحيات' },

  // Customers
  { code: 'customers.view',        module: 'customers',   action: 'read',   name: 'Lire clients',              name_fr: 'Lire clients',               name_ar: 'قراءة العملاء' },
  { code: 'customers.create',      module: 'customers',   action: 'create', name: 'Créer client',              name_fr: 'Créer client',               name_ar: 'إنشاء عميل' },
  { code: 'customers.update',      module: 'customers',   action: 'update', name: 'Modifier client',           name_fr: 'Modifier client',            name_ar: 'تعديل عميل' },
  { code: 'customers.delete',      module: 'customers',   action: 'delete', name: 'Supprimer client',          name_fr: 'Supprimer client',           name_ar: 'حذف عميل' },
  { code: 'customers.block',       module: 'customers',   action: 'block',  name: 'Bloquer client',            name_fr: 'Bloquer client',             name_ar: 'حظر عميل' },

  // Addresses
  { code: 'addresses.view',        module: 'addresses',   action: 'read',   name: 'Lire adresses',             name_fr: 'Lire adresses',              name_ar: 'قراءة العناوين' },
  { code: 'addresses.create',      module: 'addresses',   action: 'create', name: 'Créer adresse',             name_fr: 'Créer adresse',              name_ar: 'إنشاء عنوان' },
  { code: 'addresses.update',      module: 'addresses',   action: 'update', name: 'Modifier adresse',          name_fr: 'Modifier adresse',           name_ar: 'تعديل عنوان' },
  { code: 'addresses.delete',      module: 'addresses',   action: 'delete', name: 'Supprimer adresse',         name_fr: 'Supprimer adresse',          name_ar: 'حذف عنوان' },

  // Orders
  { code: 'orders.view',           module: 'orders',      action: 'read',   name: 'Lire commandes',            name_fr: 'Lire commandes',             name_ar: 'قراءة الطلبات' },
  { code: 'orders.create',         module: 'orders',      action: 'create', name: 'Créer commande',            name_fr: 'Créer commande',             name_ar: 'إنشاء طلب' },
  { code: 'orders.update_status',  module: 'orders',      action: 'update', name: 'Modifier statut commande',  name_fr: 'Modifier statut commande',   name_ar: 'تعديل حالة الطلب' },
  { code: 'orders.cancel',         module: 'orders',      action: 'delete', name: 'Annuler commande',          name_fr: 'Annuler commande',           name_ar: 'إلغاء طلب' },

  // Picking
  { code: 'picking.view',          module: 'picking',     action: 'read',   name: 'Voir picking',              name_fr: 'Voir picking',               name_ar: 'عرض التحضير' },
  { code: 'picking.update',        module: 'picking',     action: 'update', name: 'Mettre à jour picking',     name_fr: 'Mettre à jour picking',      name_ar: 'تحديث التحضير' },

  // Delivery
  { code: 'delivery.view',         module: 'delivery',    action: 'read',   name: 'Voir livraison',            name_fr: 'Voir livraison',             name_ar: 'عرض التوصيل' },
  { code: 'delivery.update',       module: 'delivery',    action: 'update', name: 'Mettre à jour livraison',   name_fr: 'Mettre à jour livraison',    name_ar: 'تحديث التوصيل' },

  // Stock
  { code: 'stock.view',            module: 'stock',       action: 'read',   name: 'Lire stock',                name_fr: 'Lire stock',                 name_ar: 'قراءة المخزون' },
  { code: 'stock.manage',          module: 'stock',       action: 'update', name: 'Gérer stock',               name_fr: 'Gérer stock',                name_ar: 'إدارة المخزون' },
  { code: 'stock.adjust',          module: 'stock',       action: 'update', name: 'Ajuster stock',             name_fr: 'Ajuster stock',              name_ar: 'تعديل المخزون' },

  // Catalog
  { code: 'articles.view',         module: 'catalog',     action: 'read',   name: 'Lire articles',             name_fr: 'Lire articles',              name_ar: 'قراءة المنتجات' },
  { code: 'articles.create',       module: 'catalog',     action: 'create', name: 'Créer article',             name_fr: 'Créer article',              name_ar: 'إنشاء منتج' },
  { code: 'articles.update',       module: 'catalog',     action: 'update', name: 'Modifier article',          name_fr: 'Modifier article',           name_ar: 'تعديل منتج' },
  { code: 'articles.delete',       module: 'catalog',     action: 'delete', name: 'Supprimer article',         name_fr: 'Supprimer article',          name_ar: 'حذف منتج' },
  { code: 'skus.view',             module: 'catalog',     action: 'read',   name: 'Lire SKU',                  name_fr: 'Lire SKU',                   name_ar: 'قراءة SKU' },
  { code: 'sku_images.view',       module: 'catalog',     action: 'read',   name: 'Lire images SKU',           name_fr: 'Lire images SKU',            name_ar: 'قراءة صور SKU' },

  // Catalog taxonomy / refs
  { code: 'families.view',         module: 'catalog',     action: 'read',   name: 'Lire familles',             name_fr: 'Lire familles',              name_ar: 'قراءة العائلات' },
  { code: 'categories.view',       module: 'catalog',     action: 'read',   name: 'Lire catégories',           name_fr: 'Lire catégories',            name_ar: 'قراءة الفئات' },
  { code: 'sub_categories.view',   module: 'catalog',     action: 'read',   name: 'Lire sous-catégories',      name_fr: 'Lire sous-catégories',       name_ar: 'قراءة الفئات الفرعية' },
  { code: 'brands.view',           module: 'catalog',     action: 'read',   name: 'Lire marques',              name_fr: 'Lire marques',               name_ar: 'قراءة العلامات' },
  { code: 'units.view',            module: 'catalog',     action: 'read',   name: 'Lire unités',               name_fr: 'Lire unités',                name_ar: 'قراءة الوحدات' },
  { code: 'article_types.view',    module: 'catalog',     action: 'read',   name: 'Lire types article',        name_fr: 'Lire types article',         name_ar: 'قراءة أنواع المنتجات' },
  { code: 'article_statuses.view', module: 'catalog',     action: 'read',   name: 'Lire statuts article',      name_fr: 'Lire statuts article',       name_ar: 'قراءة حالات المنتجات' },
  { code: 'taxes.view',            module: 'catalog',     action: 'read',   name: 'Lire taxes',                name_fr: 'Lire taxes',                 name_ar: 'قراءة الضرائب' },
  { code: 'packaging_types.view',  module: 'catalog',     action: 'read',   name: 'Lire types emballage',      name_fr: 'Lire types emballage',       name_ar: 'قراءة أنواع التعبئة' },
  { code: 'conservation_types.view',module:'catalog',     action: 'read',   name: 'Lire types conservation',   name_fr: 'Lire types conservation',    name_ar: 'قراءة أنواع الحفظ' },

  // Geography & Nodes
  { code: 'regions.view',          module: 'geography',   action: 'read',   name: 'Lire régions',              name_fr: 'Lire régions',               name_ar: 'قراءة المناطق' },
  { code: 'provinces.view',        module: 'geography',   action: 'read',   name: 'Lire provinces',            name_fr: 'Lire provinces',             name_ar: 'قراءة المقاطعات' },
  { code: 'cities.view',           module: 'geography',   action: 'read',   name: 'Lire villes',               name_fr: 'Lire villes',                name_ar: 'قراءة المدن' },
  { code: 'nodes.view',            module: 'nodes',       action: 'read',   name: 'Lire nodes',                name_fr: 'Lire nodes',                 name_ar: 'قراءة النودات' },
  { code: 'nodes.manage',          module: 'nodes',       action: 'update', name: 'Gérer nodes',               name_fr: 'Gérer nodes',                name_ar: 'إدارة النودات' },
  { code: 'node_types.view',       module: 'nodes',       action: 'read',   name: 'Lire types node',           name_fr: 'Lire types node',            name_ar: 'قراءة أنواع النودات' },

  // Warehouse
  { code: 'warehouse.view',        module: 'warehouse',   action: 'read',   name: 'Lire entrepôt',             name_fr: 'Lire entrepôt',              name_ar: 'قراءة المستودع' },
  { code: 'warehouse.manage',      module: 'warehouse',   action: 'update', name: 'Gérer entrepôt',            name_fr: 'Gérer entrepôt',             name_ar: 'إدارة المستودع' },

  // Settings
  { code: 'settings.read',         module: 'settings',    action: 'read',   name: 'Lire paramètres',           name_fr: 'Lire paramètres',            name_ar: 'قراءة الإعدادات' },
  { code: 'settings.update',       module: 'settings',    action: 'update', name: 'Modifier paramètres',       name_fr: 'Modifier paramètres',        name_ar: 'تعديل الإعدادات' },
];

// ── ROLE PERMISSIONS MAPPING ──────────────────────────────────────────────────
const ROLE_PERMISSIONS = {
  superadmin: '__ALL__', // toutes les permissions
  backoffice_admin: [
    'dashboard.view',
    'users.view', 'users.create', 'users.update',
    'roles.view', 'permissions.view',
    'customers.view', 'customers.update', 'customers.block',
    'addresses.view',
    'orders.view', 'orders.update_status', 'orders.cancel',
    'stock.view',
    'articles.view', 'skus.view', 'sku_images.view',
    'families.view', 'categories.view', 'sub_categories.view', 'brands.view', 'units.view',
    'regions.view', 'provinces.view', 'cities.view',
    'nodes.view', 'node_types.view',
    'warehouse.view', 'warehouse.manage',
    'settings.read',
  ],
  manager_node: [
    'dashboard.view',
    'customers.view',
    'orders.view', 'orders.update_status',
    'picking.view', 'picking.update',
    'delivery.view', 'delivery.update',
    'stock.view', 'stock.adjust',
    'articles.view', 'skus.view',
    'nodes.view',
    'warehouse.view',
  ],
  picker: [
    'dashboard.view',
    'orders.view', 'orders.update_status',
    'picking.view', 'picking.update',
    'stock.view',
    'articles.view', 'skus.view',
  ],
  driver: [
    'dashboard.view',
    'orders.view', 'orders.update_status',
    'delivery.view', 'delivery.update',
    'customers.view',
    'addresses.view',
  ],
  customer: [], // pas d'accès back-office
};

async function main() {
  // 1. Upsert roles
  console.log('Seeding roles...');
  for (const r of ROLES) {
    await p.role.upsert({
      where: { code: r.code },
      update: { name_fr: r.name_fr, name_ar: r.name_ar, is_system: r.is_system, is_active: r.is_active },
      create: { ...r },
    });
  }
  console.log(`  ✓ ${ROLES.length} rôles`);

  // 2. Upsert permissions
  console.log('Seeding permissions...');
  for (const perm of PERMISSIONS) {
    await p.permission.upsert({
      where: { code: perm.code },
      update: { name_fr: perm.name_fr, name_ar: perm.name_ar, action: perm.action, module: perm.module },
      create: { ...perm },
    });
  }
  console.log(`  ✓ ${PERMISSIONS.length} permissions`);

  // 3. Role-permissions
  console.log('Assigning role-permissions...');
  const allRoles = await p.role.findMany();
  const allPerms = await p.permission.findMany();
  const permByCode = Object.fromEntries(allPerms.map(p => [p.code, p]));

  for (const role of allRoles) {
    const mapping = ROLE_PERMISSIONS[role.code];
    if (!mapping) continue;
    const codes = mapping === '__ALL__' ? allPerms.map(p => p.code) : mapping;

    for (const code of codes) {
      const perm = permByCode[code];
      if (!perm) { console.warn(`  ⚠ Permission not found: ${code}`); continue; }
      await p.rolePermission.upsert({
        where: { role_id_permission_id: { role_id: role.id, permission_id: perm.id } },
        update: {},
        create: { role_id: role.id, permission_id: perm.id },
      });
    }
    const count = codes.length;
    console.log(`  ✓ ${role.code}: ${count} permissions assigned`);
  }

  // 4. Update existing admin user to superadmin role if exists
  const superRole = await p.role.findUnique({ where: { code: 'superadmin' } });
  if (superRole) {
    const adminUser = await p.user.findFirst({ where: { email: 'admin@test.com' } });
    if (adminUser) {
      await p.userRole.upsert({
        where: { user_id_role_id: { user_id: adminUser.id, role_id: superRole.id } },
        update: {},
        create: { user_id: adminUser.id, role_id: superRole.id },
      });
      await p.user.update({ where: { id: adminUser.id }, data: { is_active: true, is_deleted: false } });
      console.log(`  ✓ admin@test.com → superadmin`);
    }
  }

  console.log('\n✅ Auth system seeded successfully!');
}

main().catch(console.error).finally(() => p.$disconnect());
