/**
 * Étape « acces » : permissions (toutes celles déclarées dans les routes), rôles
 * (FR/AR), super admin avec TOUTES les permissions, comptes back-office de test.
 */
const fs = require('fs');
const path = require('path');
const { passwordHash } = require('../lib/util');
const { ADMIN_EMAIL } = require('../lib/ctx');

const ROLES = [
  { codes: ['super_admin', 'superadmin', 'SUPER_ADMIN'], code: 'super_admin', name: 'Super Admin', name_fr: 'Super administrateur', name_ar: 'مدير عام', is_system: true },
  { codes: ['backoffice_admin'], code: 'backoffice_admin', name: 'Backoffice Admin', name_fr: 'Administrateur back-office', name_ar: 'مدير الواجهة الخلفية', is_system: true },
  { codes: ['manager_node'], code: 'manager_node', name: 'Manager Node', name_fr: 'Responsable de node', name_ar: 'مسؤول المتجر', is_system: false },
  { codes: ['picker'], code: 'picker', name: 'Picker', name_fr: 'Préparateur de commandes', name_ar: 'مُحضّر الطلبات', is_system: false },
  { codes: ['driver'], code: 'driver', name: 'Driver', name_fr: 'Livreur', name_ar: 'موزع / سائق', is_system: false },
  { codes: ['customer'], code: 'customer', name: 'Customer', name_fr: 'Client', name_ar: 'زبون', is_system: false },
];

const BO_USERS = [
  { email: 'nadia.berrada@example.com', full_name: 'Nadia Berrada', phone: '600000001', role: 'backoffice_admin', node: null },
  { email: 'hamza.elidrissi@example.com', full_name: 'Hamza El Idrissi', phone: '600000011', role: 'manager_node', node: 'CASA-MAARIF' },
  { email: 'salma.chraibi@example.com', full_name: 'Salma Chraibi', phone: '600000012', role: 'manager_node', node: 'CASA-AINSEBAA' },
  { email: 'omar.benjelloun@example.com', full_name: 'Omar Benjelloun', phone: '600000013', role: 'manager_node', node: 'RABAT-AGDAL' },
  { email: 'houda.lahlou@example.com', full_name: 'Houda Lahlou', phone: '600000014', role: 'manager_node', node: 'MRK-GUELIZ' },
];

const ACTIONS_FR = { view: 'Consulter', read: 'Consulter', create: 'Créer', update: 'Modifier', delete: 'Supprimer', manage: 'Gérer', receive: 'Réceptionner', assign: 'Affecter', block: 'Bloquer', export: 'Exporter', cancel: 'Annuler', update_status: 'Changer le statut', reassign: 'Réaffecter' };

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.routes?\.js$/.test(e.name)) out.push(full);
  }
  return out;
}

function routePermissionCodes() {
  const srcDir = path.join(__dirname, '..', '..', '..', 'src');
  const codes = new Set();
  for (const f of walk(srcDir)) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/perm\(\s*['"]([a-z_]+\.[a-z_]+)['"]\s*\)/g)) codes.add(m[1]);
    for (const m of src.matchAll(/permAny\(\s*\[([^\]]+)\]/g)) {
      for (const c of m[1].matchAll(/['"]([a-z_]+\.[a-z_]+)['"]/g)) codes.add(c[1]);
    }
  }
  return [...codes].sort();
}

/** Permissions par défaut des rôles créés (jamais imposées à un rôle existant déjà paramétré). */
function defaultPerms(roleCode, all) {
  if (roleCode === 'backoffice_admin') return all.filter((p) => !/^(roles|permissions)\./.test(p.code));
  if (roleCode === 'manager_node') {
    return all.filter((p) => /\.(view|read)$/.test(p.code)
      || /^(orders|picking|pickers|drivers|delivery|tours|pickup|stock|stock_counts|quality_checks|purchase_orders|customers|payments)\./.test(p.code));
  }
  return [];
}

async function run(ctx) {
  const { prisma } = ctx;

  // 1. Permissions déclarées dans les routes
  const codes = routePermissionCodes();
  const existing = new Set((await prisma.permission.findMany({ select: { code: true } })).map((p) => p.code));
  for (const code of codes) {
    if (existing.has(code)) continue;
    const [module, action] = code.split('.');
    const label = `${ACTIONS_FR[action] || action} — ${module.replace(/_/g, ' ')}`;
    ctx.count('permissions');
    if (!ctx.dry) {
      await prisma.permission.create({ data: { code, module, action, name: label, name_fr: label, name_ar: label } });
    }
  }
  ctx.log(`${codes.length} codes de permission dans les routes, ${codes.filter((c) => !existing.has(c)).length} ajoutés`);

  // 2. Rôles
  const roles = {};
  for (const r of ROLES) {
    let role = await prisma.role.findFirst({ where: { code: { in: r.codes } } });
    const isNew = !role;
    if (!role) {
      ctx.count('roles');
      if (!ctx.dry) {
        role = await prisma.role.create({
          data: { code: r.code, name: r.name, name_fr: r.name_fr, name_ar: r.name_ar, is_system: r.is_system, is_active: true, status: 'active', description: r.name_fr },
        });
      }
    } else if (!ctx.dry && (!role.name_fr || !role.name_ar)) {
      role = await prisma.role.update({ where: { id: role.id }, data: { name_fr: role.name_fr || r.name_fr, name_ar: role.name_ar || r.name_ar } });
    }
    roles[r.code] = role ? { ...role, isNew } : null;
  }
  if (ctx.dry) { ctx.log('dry-run : rôles / comptes comptés'); }

  // 3. Permissions des rôles
  const allPerms = ctx.dry ? [] : await prisma.permission.findMany();
  const grant = async (role, perms) => {
    if (!role || ctx.dry) return 0;
    const have = new Set((await prisma.rolePermission.findMany({ where: { role_id: role.id }, select: { permission_id: true } })).map((x) => x.permission_id));
    const missing = perms.filter((p) => !have.has(p.id));
    if (missing.length) {
      await prisma.rolePermission.createMany({ data: missing.map((p) => ({ role_id: role.id, permission_id: p.id })), skipDuplicates: true });
      ctx.count('role_permissions', missing.length);
    }
    return missing.length;
  };
  if (!ctx.dry) {
    const n = await grant(roles.super_admin, allPerms);
    ctx.log(`super_admin : ${allPerms.length} permissions (${n} ajoutées)`);
    for (const code of ['backoffice_admin', 'manager_node']) {
      const role = roles[code];
      const count = await prisma.rolePermission.count({ where: { role_id: role.id } });
      if (role.isNew || count === 0) await grant(role, defaultPerms(code, allPerms));
    }
  }

  // 4. Super admin conservé / créé
  const hash = await passwordHash();
  let admin = await prisma.user.findFirst({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    ctx.count('users');
    if (!ctx.dry) {
      admin = await prisma.user.create({
        data: { email: ADMIN_EMAIL, full_name: 'Administrateur ATINA', password_hash: hash, status: 'active', is_active: true, phone_country: '+212', phone_number: '600000000', phone: '+212600000000' },
      });
      ctx.warn(`${ADMIN_EMAIL} n'existait pas : créé avec le mot de passe de test Test@2026`);
    }
  } else if (!ctx.dry && (admin.status !== 'active' || !admin.is_active || admin.is_deleted)) {
    admin = await prisma.user.update({ where: { id: admin.id }, data: { status: 'active', is_active: true, is_deleted: false } });
  }
  if (admin && roles.super_admin && !ctx.dry) {
    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: admin.id, role_id: roles.super_admin.id } },
      update: {},
      create: { user_id: admin.id, role_id: roles.super_admin.id },
    });
  }

  // 5. Comptes back-office de test
  const nodes = Object.fromEntries((await ctx.nodes()).map((n) => [n.code, n]));
  for (const u of BO_USERS) {
    let user = await prisma.user.findFirst({ where: { email: u.email } });
    if (!user) {
      ctx.count('users');
      if (ctx.dry) continue;
      user = await prisma.user.create({
        data: {
          email: u.email, full_name: u.full_name, password_hash: hash, status: 'active', is_active: true,
          phone: `+212${u.phone}`, phone_country: '+212', phone_number: u.phone, phone_verified_at: new Date(),
        },
      });
    }
    if (ctx.dry) continue;
    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: user.id, role_id: roles[u.role].id } },
      update: {},
      create: { user_id: user.id, role_id: roles[u.role].id },
    });
    const nodeId = u.node ? nodes[u.node]?.id ?? null : null;
    const bo = await prisma.backofficeAdmin.findUnique({ where: { user_id: user.id } });
    if (!bo) {
      await prisma.backofficeAdmin.create({ data: { user_id: user.id, node_id: nodeId, created_by: admin?.id ?? null } });
      ctx.count('backoffice_admins');
    } else if (nodeId && bo.node_id !== nodeId) {
      await prisma.backofficeAdmin.update({ where: { id: bo.id }, data: { node_id: nodeId } });
    }
  }
}

module.exports = { name: 'acces', label: 'Permissions, rôles et comptes back-office', run, BO_USERS };
