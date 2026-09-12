const prisma = require('../config/database');

const roleInclude = {
  role_permissions: {
    include: { permission: true },
  },
};

const findAll = (where = {}) =>
  prisma.role.findMany({
    where,
    include: {
      ...roleInclude,
      creator: { select: { id: true, full_name: true } },
      _count: { select: { user_roles: true } },
    },
    orderBy: [{ is_system: 'desc' }, { created_at: 'asc' }],
  });

const findById = (id) =>
  prisma.role.findUnique({
    where: { id },
    include: { ...roleInclude, creator: { select: { id: true, full_name: true } }, _count: { select: { user_roles: true } } },
  });

const findByCode = (code) =>
  prisma.role.findUnique({ where: { code } });

const create = (data) =>
  prisma.role.create({ data, include: roleInclude });

const update = (id, data) =>
  prisma.role.update({ where: { id }, data, include: roleInclude });

const remove = (id) =>
  prisma.role.delete({ where: { id } });

const setPermissions = async (roleId, permissionIds) => {
  await prisma.rolePermission.deleteMany({ where: { role_id: roleId } });
  if (permissionIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: permissionIds.map((pid) => ({ role_id: roleId, permission_id: pid })),
      skipDuplicates: true,
    });
  }
  return prisma.role.findUnique({ where: { id: roleId }, include: roleInclude });
};

module.exports = { findAll, findById, findByCode, create, update, remove, setPermissions };
