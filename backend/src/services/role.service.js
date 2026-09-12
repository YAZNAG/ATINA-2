const prisma = require('../config/database');
const roleRepository = require('../repositories/role.repository');
const { audit } = require('../utils/audit');

const RESOURCE = 'roles';
const bad = (message, statusCode = 400) => ({ statusCode, message });
const isActive = (r) => Boolean(r && r.is_active && r.status === 'active');
const trimOrNull = (v) => {
  if (v === undefined) return undefined;
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
};

/** Ajoute le libellé d'affichage, l'état actif et les compteurs. */
const present = (role) => {
  if (!role) return role;
  const { _count, ...r } = role;
  return {
    ...r,
    label: r.name_fr || r.name,
    active: isActive(r),
    users_count: _count?.user_roles ?? undefined,
    permissions_count: r.role_permissions?.length ?? undefined,
  };
};

class RoleService {
  /**
   * « Liste des rôles » (US-001). Filtres : search, status (active | inactive),
   * assignable=true : uniquement les rôles actifs (listes d'affectation, US-003).
   */
  async getAll(params = {}) {
    const where = {};
    const assignable = params.assignable === 'true' || params.assignable === true;
    if (assignable || params.status === 'active') Object.assign(where, { is_active: true, status: 'active' });
    else if (params.status === 'inactive') where.OR = [{ is_active: false }, { status: { not: 'active' } }];
    if (params.search && String(params.search).trim()) {
      const q = String(params.search).trim();
      where.AND = [{
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { name_fr: { contains: q, mode: 'insensitive' } },
          { name_ar: { contains: q, mode: 'insensitive' } },
        ],
      }];
    }
    const roles = await roleRepository.findAll(where);
    return roles.map(present);
  }

  async getById(id) {
    const role = await roleRepository.findById(Number(id));
    if (!role) throw bad('Rôle introuvable', 404);
    return present(role);
  }

  async create(body = {}, req = null) {
    const code = String(body.code ?? '').trim().toLowerCase();
    const name_fr = trimOrNull(body.name_fr) ?? trimOrNull(body.name);
    if (!code) throw bad('Code du rôle requis');
    if (!/^[a-z0-9_]+$/.test(code)) throw bad('Code invalide : minuscules, chiffres et tirets bas uniquement');
    if (!name_fr) throw bad('Nom (FR) du rôle requis');
    const existing = await roleRepository.findByCode(code);
    if (existing) throw bad('Ce code de rôle est déjà utilisé', 409);

    const active = body.status ? body.status === 'active' : (body.is_active === undefined ? true : Boolean(body.is_active));
    const data = {
      code,
      name: trimOrNull(body.name) ?? name_fr,
      name_fr,
      name_ar: trimOrNull(body.name_ar) ?? null,
      description: trimOrNull(body.description) ?? null,
      status: active ? 'active' : 'inactive',
      is_active: active,
      created_by: req?.user?.id ?? null,
    };
    const permission_ids = Array.isArray(body.permission_ids) ? body.permission_ids.map(Number) : [];
    let role = await roleRepository.create(data);
    if (permission_ids.length > 0) role = await roleRepository.setPermissions(role.id, permission_ids);
    await audit(req, { action: 'CREATE', resource: RESOURCE, resource_id: role.id, new_values: { ...data, permission_ids } });
    return present(role);
  }

  async update(id, body = {}, req = null) {
    const roleId = Number(id);
    const existing = await roleRepository.findById(roleId);
    if (!existing) throw bad('Rôle introuvable', 404);

    const data = {};
    if (body.code !== undefined && String(body.code).trim().toLowerCase() !== existing.code) {
      if (existing.is_system) throw bad("Le code d'un rôle système n'est pas modifiable");
      const code = String(body.code).trim().toLowerCase();
      if (!/^[a-z0-9_]+$/.test(code)) throw bad('Code invalide : minuscules, chiffres et tirets bas uniquement');
      const dup = await roleRepository.findByCode(code);
      if (dup && dup.id !== roleId) throw bad('Ce code de rôle est déjà utilisé', 409);
      data.code = code;
    }
    if (body.name_fr !== undefined) {
      const v = trimOrNull(body.name_fr);
      if (!v) throw bad('Nom (FR) du rôle requis');
      data.name_fr = v;
      data.name = trimOrNull(body.name) ?? v;
    } else if (body.name !== undefined) {
      const v = trimOrNull(body.name);
      if (!v) throw bad('Nom du rôle requis');
      data.name = v;
    }
    if (body.name_ar !== undefined) data.name_ar = trimOrNull(body.name_ar);
    if (body.description !== undefined) data.description = trimOrNull(body.description);
    if (body.status !== undefined || body.is_active !== undefined) {
      const active = body.status !== undefined ? body.status === 'active' : Boolean(body.is_active);
      data.status = active ? 'active' : 'inactive';
      data.is_active = active;
    }

    const old_values = {};
    const new_values = {};
    Object.keys(data).forEach((k) => {
      if (JSON.stringify(existing[k] ?? null) !== JSON.stringify(data[k] ?? null)) {
        old_values[k] = existing[k] ?? null;
        new_values[k] = data[k];
      }
    });

    let role = await roleRepository.update(roleId, data);
    if (Array.isArray(body.permission_ids)) {
      role = await roleRepository.setPermissions(roleId, body.permission_ids.map(Number));
      old_values.permissions = existing.role_permissions.map((rp) => rp.permission.code);
      new_values.permissions = role.role_permissions.map((rp) => rp.permission.code);
    }
    if (Object.keys(new_values).length) {
      const keys = Object.keys(new_values);
      let action = 'UPDATE';
      if (keys.every((k) => ['status', 'is_active'].includes(k))) action = data.is_active ? 'ACTIVATE' : 'DEACTIVATE';
      await audit(req, { action, resource: RESOURCE, resource_id: roleId, old_values, new_values });
    }
    return present(role);
  }

  /**
   * US-003 : activer / désactiver un rôle. Un rôle inactif n'est plus assignable ;
   * les comptes existants conservent leur rôle.
   */
  async setActive(id, active, req = null) {
    const roleId = Number(id);
    const existing = await roleRepository.findById(roleId);
    if (!existing) throw bad('Rôle introuvable', 404);
    if (isActive(existing) === Boolean(active)) return present(existing);
    const role = await roleRepository.update(roleId, { is_active: Boolean(active), status: active ? 'active' : 'inactive' });
    await audit(req, {
      action: active ? 'ACTIVATE' : 'DEACTIVATE',
      resource: RESOURCE,
      resource_id: roleId,
      old_values: { is_active: existing.is_active, status: existing.status },
      new_values: { is_active: Boolean(active), status: active ? 'active' : 'inactive' },
    });
    return present(role);
  }

  async delete(id, req = null) {
    const roleId = Number(id);
    const role = await roleRepository.findById(roleId);
    if (!role) throw bad('Rôle introuvable', 404);
    if (role.is_system) throw bad('Rôle système : suppression impossible. Désactivez-le à la place.', 409);
    const [users, pickers, drivers] = await Promise.all([
      prisma.userRole.count({ where: { role_id: roleId } }),
      prisma.picker.count({ where: { role_id: roleId, is_deleted: false } }),
      prisma.driver.count({ where: { role_id: roleId, is_deleted: false } }),
    ]);
    if (users + pickers + drivers > 0) {
      throw bad(`Rôle utilisé par ${users + pickers + drivers} compte(s) : suppression impossible. Désactivez-le à la place.`, 409);
    }
    await roleRepository.remove(roleId);
    await audit(req, {
      action: 'DELETE',
      resource: RESOURCE,
      resource_id: roleId,
      old_values: { code: role.code, name_fr: role.name_fr, permissions: role.role_permissions.map((rp) => rp.permission.code) },
    });
  }

  /** US-002 : carte de permissions d'un rôle — tracée dans audit_logs. */
  async assignPermissions(roleId, permissionIds, req = null) {
    const id = Number(roleId);
    const role = await roleRepository.findById(id);
    if (!role) throw bad('Rôle introuvable', 404);
    const ids = [...new Set((permissionIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    if (ids.length) {
      const found = await prisma.permission.count({ where: { id: { in: ids } } });
      if (found !== ids.length) throw bad('Permission introuvable dans la liste envoyée');
    }
    const before = role.role_permissions.map((rp) => rp.permission.code).sort();
    const updated = await roleRepository.setPermissions(id, ids);
    const after = updated.role_permissions.map((rp) => rp.permission.code).sort();
    const added = after.filter((c) => !before.includes(c));
    const removed = before.filter((c) => !after.includes(c));
    if (added.length || removed.length) {
      await audit(req, {
        action: 'ASSIGN_PERMISSIONS',
        resource: RESOURCE,
        resource_id: id,
        old_values: { permissions: before },
        new_values: { permissions: after, added, removed },
      });
    }
    return present(updated);
  }

  /**
   * US-121 : dupliquer un rôle existant — même carte de permissions, nouveau
   * code. Le rôle créé est toujours inactif tant qu'il n'est pas relu.
   */
  async duplicate(id, body = {}, req = null) {
    const source = await roleRepository.findById(Number(id));
    if (!source) throw bad('Rôle introuvable', 404);

    const code = String(body.code ?? `${source.code}_copie`).trim().toLowerCase();
    if (!/^[a-z0-9_]+$/.test(code)) throw bad('Code invalide : minuscules, chiffres et tirets bas uniquement');
    if (await roleRepository.findByCode(code)) throw bad('Ce code de rôle est déjà utilisé', 409);

    const name_fr = trimOrNull(body.name_fr) ?? `${source.name_fr || source.name} (copie)`;
    const created = await roleRepository.create({
      code,
      name: name_fr,
      name_fr,
      name_ar: trimOrNull(body.name_ar) ?? source.name_ar,
      description: trimOrNull(body.description) ?? source.description,
      // Un rôle système reste système : la copie, elle, est un rôle ordinaire.
      status: 'inactive',
      is_active: false,
      created_by: req?.user?.id ?? null,
    });
    const permission_ids = source.role_permissions.map((rp) => rp.permission_id);
    const role = permission_ids.length
      ? await roleRepository.setPermissions(created.id, permission_ids)
      : created;
    await audit(req, {
      action: 'CREATE',
      resource: RESOURCE,
      resource_id: role.id,
      new_values: {
        code, name_fr, duplicated_from: source.code,
        permissions: source.role_permissions.map((rp) => rp.permission.code),
      },
    });
    return present(role);
  }

  async getRolePermissions(roleId) {
    const role = await roleRepository.findById(Number(roleId));
    if (!role) throw bad('Rôle introuvable', 404);
    return role.role_permissions.map((rp) => rp.permission);
  }
}

module.exports = new RoleService();
