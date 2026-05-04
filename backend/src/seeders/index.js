require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const catalogSeeder = require('./catalog.seeder');

const prisma = new PrismaClient();

const PERMISSIONS = [
  { name: 'View Users', code: 'users.view', module: 'users', description: 'View user list and details' },
  { name: 'Create Users', code: 'users.create', module: 'users', description: 'Create new users' },
  { name: 'Update Users', code: 'users.update', module: 'users', description: 'Edit existing users' },
  { name: 'Delete Users', code: 'users.delete', module: 'users', description: 'Delete users' },
  { name: 'View Roles', code: 'roles.view', module: 'roles', description: 'View role list' },
  { name: 'Create Roles', code: 'roles.create', module: 'roles', description: 'Create new roles' },
  { name: 'Update Roles', code: 'roles.update', module: 'roles', description: 'Edit existing roles' },
  { name: 'Delete Roles', code: 'roles.delete', module: 'roles', description: 'Delete roles' },
  { name: 'View Permissions', code: 'permissions.view', module: 'permissions', description: 'View permissions list' },
  { name: 'Assign Permissions', code: 'permissions.assign', module: 'permissions', description: 'Assign permissions to roles' },
  { name: 'View Dashboard', code: 'dashboard.view', module: 'dashboard', description: 'Access the dashboard' },
  { name: 'View App Customers', code: 'customers.view', module: 'customers', description: 'List P0 app customers (mobile)' },
];

async function main() {
  console.log('Seeding database...');

  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({ where: { code: perm.code }, update: {}, create: perm });
  }
  console.log(`${PERMISSIONS.length} core permissions created.`);

  const superAdminRole = await prisma.role.upsert({
    where: { code: 'super_admin' },
    update: {},
    create: { name: 'Super Admin', code: 'super_admin', description: 'Full access to all features', status: 'active' },
  });

  const passwordHash = await bcrypt.hash('Admin@12345', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@darkstore.local' },
    update: {},
    create: { full_name: 'Super Admin', email: 'admin@darkstore.local', password_hash: passwordHash, status: 'active' },
  });

  await prisma.userRole.upsert({
    where: { user_id_role_id: { user_id: adminUser.id, role_id: superAdminRole.id } },
    update: {},
    create: { user_id: adminUser.id, role_id: superAdminRole.id },
  });

  // Seed catalog data (permissions + reference data)
  await catalogSeeder.main();

  // Assign ALL permissions to Super Admin
  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: superAdminRole.id, permission_id: perm.id } },
      update: {},
      create: { role_id: superAdminRole.id, permission_id: perm.id },
    });
  }

  console.log('\nCredentials:');
  console.log('  Email   : admin@darkstore.local');
  console.log('  Password: Admin@12345');
  console.log('\nSeeding complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
