/**
 * seedStaffPermissions.js — Ajoute les permissions staff + réassigne les rôles
 * Run: node scripts/seedStaffPermissions.js
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const NEW_PERMS = [
  // Pickers management (back-office)
  { code: 'pickers.read',           module: 'pickers',       action: 'read',           name: 'Lire pickers',           name_fr: 'Lire les pickers',            name_ar: 'قراءة المحضرين' },
  { code: 'pickers.create',         module: 'pickers',       action: 'create',         name: 'Créer picker',           name_fr: 'Créer un picker',             name_ar: 'إنشاء محضر' },
  { code: 'pickers.update',         module: 'pickers',       action: 'update',         name: 'Modifier picker',        name_fr: 'Modifier un picker',          name_ar: 'تعديل محضر' },
  { code: 'pickers.delete',         module: 'pickers',       action: 'delete',         name: 'Supprimer picker',       name_fr: 'Supprimer un picker',         name_ar: 'حذف محضر' },
  { code: 'pickers.activate',       module: 'pickers',       action: 'update',         name: 'Activer picker',         name_fr: 'Activer un picker',           name_ar: 'تفعيل محضر' },
  { code: 'pickers.deactivate',     module: 'pickers',       action: 'update',         name: 'Désactiver picker',      name_fr: 'Désactiver un picker',        name_ar: 'تعطيل محضر' },
  { code: 'pickers.reset_password', module: 'pickers',       action: 'update',         name: 'Reset pwd picker',       name_fr: 'Réinitialiser MDP picker',    name_ar: 'إعادة تعيين كلمة مرور المحضر' },
  // Drivers management (back-office)
  { code: 'drivers.read',           module: 'drivers',       action: 'read',           name: 'Lire drivers',           name_fr: 'Lire les livreurs',           name_ar: 'قراءة السائقين' },
  { code: 'drivers.create',         module: 'drivers',       action: 'create',         name: 'Créer driver',           name_fr: 'Créer un livreur',            name_ar: 'إنشاء سائق' },
  { code: 'drivers.update',         module: 'drivers',       action: 'update',         name: 'Modifier driver',        name_fr: 'Modifier un livreur',         name_ar: 'تعديل سائق' },
  { code: 'drivers.delete',         module: 'drivers',       action: 'delete',         name: 'Supprimer driver',       name_fr: 'Supprimer un livreur',        name_ar: 'حذف سائق' },
  { code: 'drivers.activate',       module: 'drivers',       action: 'update',         name: 'Activer driver',         name_fr: 'Activer un livreur',          name_ar: 'تفعيل سائق' },
  { code: 'drivers.deactivate',     module: 'drivers',       action: 'update',         name: 'Désactiver driver',      name_fr: 'Désactiver un livreur',       name_ar: 'تعطيل سائق' },
  { code: 'drivers.reset_password', module: 'drivers',       action: 'update',         name: 'Reset pwd driver',       name_fr: 'Réinitialiser MDP livreur',   name_ar: 'إعادة تعيين كلمة مرور السائق' },
  // Picking (operational)
  { code: 'picking.read',           module: 'picking',       action: 'read',           name: 'Lire picking',           name_fr: 'Lire les sessions picking',   name_ar: 'قراءة جلسات التحضير' },
  { code: 'picking.start',          module: 'picking',       action: 'update',         name: 'Démarrer picking',       name_fr: 'Démarrer une session',        name_ar: 'بدء جلسة التحضير' },
  { code: 'picking.complete',       module: 'picking',       action: 'update',         name: 'Terminer picking',       name_fr: 'Terminer une session',        name_ar: 'إنهاء جلسة التحضير' },
  { code: 'picking.cancel',         module: 'picking',       action: 'update',         name: 'Annuler picking',        name_fr: 'Annuler une session',         name_ar: 'إلغاء جلسة التحضير' },
  { code: 'picking_items.pick',     module: 'picking',       action: 'update',         name: 'Picker un article',      name_fr: 'Préparer un article',         name_ar: 'تحضير مقال' },
  { code: 'picking_items.substitute',module:'picking',       action: 'update',         name: 'Substituer article',     name_fr: 'Substituer un article',       name_ar: 'استبدال مقال' },
  { code: 'picking_items.out_of_stock',module:'picking',     action: 'update',         name: 'Rupture article',        name_fr: 'Marquer rupture stock',       name_ar: 'تحديد نفاد المخزون' },
  // Tours
  { code: 'tours.read',             module: 'tours',         action: 'read',           name: 'Lire tours',             name_fr: 'Lire les tournées',           name_ar: 'قراءة الجولات' },
  { code: 'tours.create',           module: 'tours',         action: 'create',         name: 'Créer tour',             name_fr: 'Créer une tournée',           name_ar: 'إنشاء جولة' },
  { code: 'tours.update',           module: 'tours',         action: 'update',         name: 'Modifier tour',          name_fr: 'Modifier une tournée',        name_ar: 'تعديل جولة' },
  { code: 'tours.start',            module: 'tours',         action: 'update',         name: 'Démarrer tour',          name_fr: 'Démarrer une tournée',        name_ar: 'بدء جولة' },
  { code: 'tours.complete',         module: 'tours',         action: 'update',         name: 'Terminer tour',          name_fr: 'Terminer une tournée',        name_ar: 'إنهاء جولة' },
  // Tour stops
  { code: 'tour_stops.read',        module: 'tours',         action: 'read',           name: 'Lire arrêts',            name_fr: 'Lire les arrêts tournée',     name_ar: 'قراءة توقفات الجولة' },
  { code: 'tour_stops.update',      module: 'tours',         action: 'update',         name: 'Modifier arrêt',         name_fr: 'Modifier un arrêt',           name_ar: 'تعديل توقف' },
  // Delivery
  { code: 'delivery.deliver',       module: 'delivery',      action: 'update',         name: 'Livrer',                 name_fr: 'Confirmer la livraison',      name_ar: 'تأكيد التسليم' },
  { code: 'delivery.fail',          module: 'delivery',      action: 'update',         name: 'Échec livraison',        name_fr: 'Déclarer échec livraison',    name_ar: 'الإعلان عن فشل التوصيل' },
  { code: 'delivery.collect_cod',   module: 'delivery',      action: 'update',         name: 'Collecter COD',          name_fr: 'Collecter paiement COD',      name_ar: 'تحصيل مدفوعات COD' },
];

// Role permissions per role code
const ROLE_PERMISSIONS = {
  superadmin:       '__ALL__',
  backoffice_admin: [
    'dashboard.view', 'users.view',
    'pickers.read','pickers.create','pickers.update','pickers.delete','pickers.activate','pickers.deactivate','pickers.reset_password',
    'drivers.read','drivers.create','drivers.update','drivers.delete','drivers.activate','drivers.deactivate','drivers.reset_password',
    'picking.read','picking.start','picking.complete','picking.cancel',
    'picking_items.pick','picking_items.substitute','picking_items.out_of_stock',
    'tours.read','tours.create','tours.update','tours.start','tours.complete',
    'tour_stops.read','tour_stops.update',
    'delivery.deliver','delivery.fail','delivery.collect_cod',
    'orders.read','orders.update_status','orders.create',
    'stock.read','customers.view','addresses.view',
  ],
  manager_node: [
    'dashboard.view',
    'pickers.read','pickers.create','pickers.update','pickers.activate','pickers.deactivate',
    'drivers.read','drivers.create','drivers.update','drivers.activate','drivers.deactivate',
    'picking.read','picking.start','picking.complete','picking.cancel',
    'picking_items.pick','picking_items.substitute','picking_items.out_of_stock',
    'tours.read','tours.create','tours.update','tours.start','tours.complete',
    'tour_stops.read','tour_stops.update',
    'delivery.deliver','delivery.fail','delivery.collect_cod',
    'orders.view','orders.update_status','orders.read',
    'stock.view','stock.read','customers.view',
  ],
  picker: [
    'dashboard.view',
    'picking.read','picking.start','picking.complete',
    'picking_items.pick','picking_items.substitute','picking_items.out_of_stock',
    'stock.view','orders.view',
  ],
  driver: [
    'dashboard.view',
    'tours.read','tour_stops.read','tour_stops.update',
    'delivery.deliver','delivery.fail','delivery.collect_cod',
    'orders.view',
  ],
  customer: [],
};

async function main() {
  console.log('🔐 Seed permissions staff + réassignation rôles\n');

  // 1. Upsert new permissions
  let created = 0;
  for (const perm of NEW_PERMS) {
    await p.permission.upsert({
      where: { code: perm.code },
      update: { name_fr: perm.name_fr, name_ar: perm.name_ar, action: perm.action, module: perm.module },
      create: { ...perm },
    });
    created++;
  }
  console.log(`✓ ${created} permissions créées/mises à jour`);

  // 2. Load all perms + roles
  const allPerms = await p.permission.findMany({ select: { id: true, code: true } });
  const allRoles = await p.role.findMany({ select: { id: true, code: true } });
  const permByCode = Object.fromEntries(allPerms.map(p => [p.code, p]));
  const roleByCode = Object.fromEntries(allRoles.map(r => [r.code, r]));

  // 3. Assign permissions per role
  let assigned = 0;
  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = roleByCode[roleCode];
    if (!role) { console.log(`  ⚠ Rôle "${roleCode}" introuvable`); continue; }

    const codes = permCodes === '__ALL__' ? allPerms.map(p => p.code) : permCodes;

    for (const code of codes) {
      const perm = permByCode[code];
      if (!perm) continue; // permission code doesn't exist yet
      try {
        await p.rolePermission.upsert({
          where: { role_id_permission_id: { role_id: role.id, permission_id: perm.id } },
          update: {},
          create: { role_id: role.id, permission_id: perm.id },
        });
        assigned++;
      } catch { /* skip duplicates */ }
    }

    const total = await p.rolePermission.count({ where: { role_id: role.id } });
    console.log(`  ✓ ${roleCode}: ${total} permissions au total`);
  }

  console.log(`\n✅ ${assigned} nouvelles assignations`);
  console.log(`   Total permissions en base: ${allPerms.length + NEW_PERMS.length}`);
}

main().catch(console.error).finally(() => p.$disconnect());
