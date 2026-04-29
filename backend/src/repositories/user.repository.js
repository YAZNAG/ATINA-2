const prisma = require('../config/database');

const userInclude = {
  user_roles: {
    include: {
      role: {
        include: {
          role_permissions: {
            include: { permission: true },
          },
        },
      },
    },
  },
};

const listInclude = {
  user_roles: {
    include: { role: true },
  },
};

const findAll = () =>
  prisma.user.findMany({ include: listInclude, orderBy: { created_at: 'desc' } });

const findById = (id) =>
  prisma.user.findUnique({ where: { id }, include: userInclude });

const findByEmail = (email) =>
  prisma.user.findUnique({ where: { email }, include: userInclude });

const create = (data) =>
  prisma.user.create({ data, include: listInclude });

const update = (id, data) =>
  prisma.user.update({ where: { id }, data, include: listInclude });

const remove = (id) =>
  prisma.user.delete({ where: { id } });

const assignRole = (userId, roleId) =>
  prisma.userRole.create({ data: { user_id: userId, role_id: roleId } });

const removeAllRoles = (userId) =>
  prisma.userRole.deleteMany({ where: { user_id: userId } });

module.exports = {
  findAll,
  findById,
  findByEmail,
  create,
  update,
  remove,
  assignRole,
  removeAllRoles,
};
