const prisma = require('../config/database');
const { hash } = require('../utils/password');
const { audit } = require('../utils/audit');

/** Codes du rôle super-administrateur (les deux graphies existent selon les seeds). */
const SUPER_ADMIN_CODES = ['super_admin', 'superadmin'];
const RESOURCE = 'users';

const bad = (message, statusCode = 400) => ({ statusCode, message });
const isSuperRole = (role) => Boolean(role && SUPER_ADMIN_CODES.includes(role.code));
const hasSuperRole = (user) => (user?.user_roles || []).some((ur) => isSuperRole(ur.role));
const roleIdsOf = (user) => (user?.user_roles || []).map((ur) => ur.role_id).sort((a, b) => a - b);

/** Compte back-office visible : sans fiche client (les comptes clients ont leur propre module). */
const BACKOFFICE_SCOPE = { customer: { is: null } };

const LIST_INCLUDE = {
  user_roles: {
    include: { role: { select: { id: true, code: true, name: true, name_fr: true, name_ar: true, is_active: true, status: true } } },
  },
  backoffice_admin: { select: { id: true, node_id: true, created_by: true, created_at: true } },
};

/** Retire le hash et expose un statut lisible (active / inactive / deleted). */
const safe = (user) => {
  if (!user) return user;
  const { password_hash, otp_code, otp_expires_at, ...u } = user;
  const account_status = u.is_deleted ? 'deleted' : (u.is_active && u.status === 'active' ? 'active' : 'inactive');
  return {
    ...u,
    account_status,
    roles: (u.user_roles || []).map((ur) => ur.role),
  };
};

const toIds = (v) => {
  if (v === undefined || v === null || v === '') return [];
  const arr = Array.isArray(v) ? v : [v];
  return [...new Set(arr.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
};

const normEmail = (e) => String(e ?? '').trim().toLowerCase();
const normPhone = (p) => {
  const s = String(p ?? '').trim();
  return s === '' ? null : s;
};

class UserService {
  /**
   * Liste des comptes back-office — filtres : search (nom, email, téléphone),
   * role_id, status (active | inactive | deleted ; par défaut les comptes supprimés sont exclus).
   */
  async getAll(params = {}) {
    const { search, role_id, status } = params;
    const and = [BACKOFFICE_SCOPE];
    if (status === 'deleted') and.push({ is_deleted: true });
    else {
      and.push({ is_deleted: false });
      if (status === 'active') and.push({ is_active: true, status: 'active' });
      if (status === 'inactive') and.push({ OR: [{ is_active: false }, { status: { not: 'active' } }] });
    }
    if (role_id) and.push({ user_roles: { some: { role_id: Number(role_id) } } });
    if (search && String(search).trim()) {
      const q = String(search).trim();
      and.push({
        OR: [
          { full_name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { phone_number: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    const where = { AND: and };
    const page = Math.max(1, parseInt(params.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(params.limit, 10) || 50));
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: [{ created_at: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);
    return { data: rows.map(safe), pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
  }

  async getById(id) {
    const user = await prisma.user.findUnique({ where: { id: Number(id) }, include: LIST_INCLUDE });
    if (!user) throw bad('Compte introuvable', 404);
    return safe(user);
  }

  async _findOr404(id) {
    const userId = Number(id);
    if (!Number.isInteger(userId)) throw bad('Identifiant de compte invalide');
    const user = await prisma.user.findUnique({ where: { id: userId }, include: LIST_INCLUDE });
    if (!user) throw bad('Compte introuvable', 404);
    return user;
  }

  async _assertEmailUnique(email, excludeId = null) {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, ...(excludeId && { NOT: { id: excludeId } }) },
      select: { id: true, is_deleted: true },
    });
    if (existing) {
      throw bad(existing.is_deleted ? 'Cet email est déjà utilisé par un compte supprimé' : 'Cet email est déjà utilisé', 409);
    }
  }

  async _assertPhoneUnique(phone, excludeId = null) {
    if (!phone) return;
    const existing = await prisma.user.findFirst({
      where: { phone, is_deleted: false, ...(excludeId && { NOT: { id: excludeId } }) },
      select: { id: true },
    });
    if (existing) throw bad('Ce téléphone est déjà utilisé par un autre compte', 409);
  }

  /**
   * US-003 : seuls les rôles ACTIFS sont assignables. Un rôle déjà porté par le
   * compte (même devenu inactif) peut être conservé.
   */
  async _assertAssignableRoles(roleIds, keepIds = []) {
    if (!roleIds.length) return [];
    const roles = await prisma.role.findMany({ where: { id: { in: roleIds } } });
    if (roles.length !== roleIds.length) throw bad('Rôle introuvable');
    const refused = roles.filter((r) => !keepIds.includes(r.id) && (!r.is_active || r.status !== 'active'));
    if (refused.length) {
      throw bad(`Rôle inactif, non assignable : ${refused.map((r) => r.name_fr || r.name).join(', ')}`);
    }
    return roles;
  }

  /** Nombre de comptes actifs porteurs d'un rôle super-admin (hors `excludeId`). */
  async _countOtherActiveSuperAdmins(excludeId) {
    return prisma.user.count({
      where: {
        id: { not: excludeId },
        is_deleted: false,
        is_active: true,
        status: 'active',
        user_roles: { some: { role: { code: { in: SUPER_ADMIN_CODES } } } },
      },
    });
  }

  /**
   * US-005 : un super-admin ne peut pas retirer son propre (dernier) accès
   * super-admin — ni en retirant le rôle, ni en se désactivant, ni en se supprimant.
   * Garde-fou global : le dernier super-admin actif ne peut pas perdre son accès.
   */
  async _assertSuperAdminKept(req, target, { nextRoles = null, deactivating = false, deleting = false }) {
    if (!hasSuperRole(target)) return;
    const losesSuper = deactivating || deleting || (nextRoles !== null && !nextRoles.some(isSuperRole));
    if (!losesSuper) return;
    if (req?.user?.id === target.id) {
      throw bad('Vous ne pouvez pas retirer votre propre accès super-admin (rôle, désactivation ou suppression de votre compte).', 403);
    }
    const others = await this._countOtherActiveSuperAdmins(target.id);
    if (others === 0) throw bad('Impossible : ce compte est le dernier super-admin actif.', 403);
  }

  async create(body = {}, req = null) {
    const full_name = String(body.full_name ?? '').trim();
    const email = normEmail(body.email);
    const phone = normPhone(body.phone);
    const status = body.status === 'inactive' ? 'inactive' : 'active';
    if (!full_name) throw bad('Nom complet requis');
    if (!email) throw bad('Email requis');
    if (!body.password || String(body.password).length < 8) throw bad('Mot de passe requis (8 caractères minimum)');
    const roleIds = toIds(body.role_ids ?? body.role_id);
    if (!roleIds.length) throw bad('Assignez au moins un rôle au compte');

    await this._assertEmailUnique(email);
    await this._assertPhoneUnique(phone);
    const roles = await this._assertAssignableRoles(roleIds);

    const password_hash = await hash(body.password);
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { full_name, email, phone, password_hash, status, is_active: status === 'active' },
      });
      await tx.userRole.createMany({ data: roleIds.map((role_id) => ({ user_id: user.id, role_id })) });
      await tx.backofficeAdmin.create({ data: { user_id: user.id, created_by: req?.user?.id ?? null } });
      await audit(req, {
        action: 'CREATE',
        resource: RESOURCE,
        resource_id: user.id,
        new_values: { full_name, email, phone, status, roles: roles.map((r) => r.code) },
      }, tx);
      return user;
    });
    return this.getById(created.id);
  }

  async update(id, body = {}, req = null) {
    const target = await this._findOr404(id);
    if (target.is_deleted) throw bad('Compte supprimé : modification impossible', 409);

    const data = {};
    if (body.full_name !== undefined) {
      const v = String(body.full_name ?? '').trim();
      if (!v) throw bad('Nom complet requis');
      data.full_name = v;
    }
    if (body.email !== undefined) {
      const v = normEmail(body.email);
      if (!v) throw bad('Email requis');
      if (v !== target.email.toLowerCase()) await this._assertEmailUnique(v, target.id);
      data.email = v;
    }
    if (body.phone !== undefined) {
      const v = normPhone(body.phone);
      if (v && v !== target.phone) await this._assertPhoneUnique(v, target.id);
      data.phone = v;
    }
    let deactivating = false;
    if (body.status !== undefined) {
      if (!['active', 'inactive'].includes(body.status)) throw bad('Statut invalide (active ou inactive)');
      data.status = body.status;
      data.is_active = body.status === 'active';
      deactivating = body.status === 'inactive' && target.status === 'active';
    }
    if (body.password) {
      if (String(body.password).length < 8) throw bad('Mot de passe : 8 caractères minimum');
      data.password_hash = await hash(body.password);
    }

    let nextRoleIds = null;
    let nextRoles = null;
    if (body.role_ids !== undefined || body.role_id !== undefined) {
      nextRoleIds = toIds(body.role_ids ?? body.role_id);
      if (!nextRoleIds.length) throw bad('Un compte back-office doit garder au moins un rôle');
      nextRoles = await this._assertAssignableRoles(nextRoleIds, roleIdsOf(target));
    }
    await this._assertSuperAdminKept(req, target, { nextRoles, deactivating });

    const rolesChanged = nextRoleIds !== null && JSON.stringify([...nextRoleIds].sort((a, b) => a - b)) !== JSON.stringify(roleIdsOf(target));
    const old_values = {};
    const new_values = {};
    for (const k of Object.keys(data)) {
      if (k === 'password_hash') { new_values.password = 'modifié'; continue; }
      if (JSON.stringify(target[k] ?? null) !== JSON.stringify(data[k] ?? null)) {
        old_values[k] = target[k] ?? null;
        new_values[k] = data[k] ?? null;
      }
    }
    if (rolesChanged) {
      old_values.roles = target.user_roles.map((ur) => ur.role.code);
      new_values.roles = nextRoles.map((r) => r.code);
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) await tx.user.update({ where: { id: target.id }, data });
      if (rolesChanged) {
        await tx.userRole.deleteMany({ where: { user_id: target.id } });
        await tx.userRole.createMany({ data: nextRoleIds.map((role_id) => ({ user_id: target.id, role_id })) });
      }
      if (Object.keys(new_values).length) {
        let action = 'UPDATE';
        const keys = Object.keys(new_values);
        if (keys.length === 1 && keys[0] === 'roles') action = 'ASSIGN_ROLE';
        else if (keys.every((k) => ['status', 'is_active'].includes(k))) action = data.is_active ? 'ACTIVATE' : 'DEACTIVATE';
        await audit(req, { action, resource: RESOURCE, resource_id: target.id, old_values, new_values }, tx);
      }
    });
    return this.getById(target.id);
  }

  /** Assigner le rôle d'un compte (remplace les rôles existants). body : { role_id } ou { role_ids: [] }. */
  async assignRole(id, body = {}, req = null) {
    if (body.role_ids === undefined && body.role_id === undefined) throw bad('Rôle requis');
    return this.update(id, { role_ids: body.role_ids ?? body.role_id }, req);
  }

  async setActive(id, active, req = null) {
    const target = await this._findOr404(id);
    if (target.is_deleted) throw bad('Compte supprimé : restaurez-le avant de le réactiver', 409);
    return this.update(id, { status: active ? 'active' : 'inactive' }, req);
  }

  /** US-006 : soft-delete (is_deleted + deleted_at) — le compte ne peut plus se connecter (sessions invalidées). */
  async delete(id, req = null) {
    const target = await this._findOr404(id);
    if (target.is_deleted) throw bad('Compte déjà supprimé', 409);
    await this._assertSuperAdminKept(req, target, { deleting: true });
    const deleted_at = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: { is_deleted: true, deleted_at, is_active: false, status: 'inactive' },
      });
      await audit(req, {
        action: 'DELETE',
        resource: RESOURCE,
        resource_id: target.id,
        old_values: { email: target.email, status: target.status, is_active: target.is_active, is_deleted: false },
        new_values: { is_deleted: true, deleted_at: deleted_at.toISOString(), status: 'inactive', is_active: false },
      }, tx);
    });
  }

  /** Restaure un compte supprimé (inactif : à réactiver explicitement). */
  async restore(id, req = null) {
    const target = await this._findOr404(id);
    if (!target.is_deleted) throw bad("Ce compte n'est pas supprimé");
    await this._assertEmailUnique(target.email.toLowerCase(), target.id);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: target.id }, data: { is_deleted: false, deleted_at: null } });
      await audit(req, {
        action: 'RESTORE', resource: RESOURCE, resource_id: target.id,
        old_values: { is_deleted: true }, new_values: { is_deleted: false },
      }, tx);
    });
    return this.getById(target.id);
  }
}

module.exports = new UserService();
module.exports.SUPER_ADMIN_CODES = SUPER_ADMIN_CODES;
