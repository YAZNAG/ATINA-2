/**
 * sync-permissions.js
 * Scans all *.routes.js files for perm('...') calls, upserts every permission
 * into the DB, then assigns ALL permissions to the Super Admin role.
 *
 * Run: node scripts/sync-permissions.js
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ── 1. Scan route files for every perm('...') call ──────────────────────────

function walkRouteFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkRouteFiles(full, results);
    } else if (entry.isFile() && entry.name.endsWith('.routes.js')) {
      results.push(full);
    }
  }
  return results;
}

function extractPermCodes(files) {
  const codes = new Set();
  const re = /perm\(['"]([a-z_]+\.[a-z_]+)['"]\)/g;
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = re.exec(src)) !== null) codes.add(m[1]);
  }
  return [...codes].sort();
}

// ── 2. Main ──────────────────────────────────────────────────────────────────

async function main() {
  const srcDir = path.join(__dirname, '../src');
  const routeFiles = walkRouteFiles(srcDir);
  const allCodes = extractPermCodes(routeFiles);

  console.log(`\nFound ${allCodes.length} permission codes in route files:\n`);
  allCodes.forEach(c => console.log('  •', c));

  // Find or create the Super Admin role
  const superAdmin = await prisma.role.findFirst({
    where: { OR: [{ code: 'SUPER_ADMIN' }, { code: 'super_admin' }, { name: 'Super Admin' }] },
  });

  if (!superAdmin) {
    console.error('\n❌ Super Admin role not found. Check the role code/name in your DB.');
    process.exit(1);
  }
  console.log(`\nSuper Admin role: id=${superAdmin.id}, name="${superAdmin.name}"`);

  // Upsert every permission (create if missing, skip if exists)
  let created = 0;
  let existing = 0;
  for (const code of allCodes) {
    const label = code
      .split('.')
      .map(w => w.replace(/_/g, ' '))
      .join(' — ');

    const module = code.split('.')[0];

    const perm = await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, name: label, module },
    });

    // Assign to Super Admin if not already assigned
    const already = await prisma.rolePermission.findFirst({
      where: { role_id: superAdmin.id, permission_id: perm.id },
    });
    if (!already) {
      await prisma.rolePermission.create({
        data: { role_id: superAdmin.id, permission_id: perm.id },
      });
      created++;
    } else {
      existing++;
    }
  }

  // Make sure ALL existing permissions in DB are also assigned to Super Admin
  const allPerms = await prisma.permission.findMany({ select: { id: true, code: true } });
  let extra = 0;
  for (const p of allPerms) {
    const already = await prisma.rolePermission.findFirst({
      where: { role_id: superAdmin.id, permission_id: p.id },
    });
    if (!already) {
      await prisma.rolePermission.create({
        data: { role_id: superAdmin.id, permission_id: p.id },
      });
      extra++;
      console.log(`  ⚡ Assigned previously-unlinked permission: ${p.code}`);
    }
  }

  const total = await prisma.permission.count();
  const assigned = await prisma.rolePermission.count({ where: { role_id: superAdmin.id } });

  console.log('\n✅ Done!');
  console.log(`   Permissions in DB:          ${total}`);
  console.log(`   Newly created permissions:  ${allCodes.length - existing - extra > 0 ? allCodes.length - existing : 0}`);
  console.log(`   Newly assigned to SA:       ${created + extra}`);
  console.log(`   Already assigned:           ${existing}`);
  console.log(`   Super Admin total assigned: ${assigned}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
