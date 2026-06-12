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

const findAll = (where = {}) =>
  prisma.user.findMany({ where, include: listInclude, orderBy: { created_at: 'desc' } });

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

const softDelete = (id) =>
  prisma.user.update({ where: { id }, data: { is_deleted: true, is_active: false, deleted_at: new Date() } });

const updateLastLogin = (id) =>
  prisma.user.update({ where: { id }, data: { last_login_at: new Date() } });

const assignRole = (userId, roleId) =>
  prisma.userRole.create({ data: { user_id: userId, role_id: roleId } });

const removeAllRoles = (userId) =>
  prisma.userRole.deleteMany({ where: { user_id: userId } });

const findByPhoneNumber = (phoneCountry, phoneNumber) =>
  prisma.user.findFirst({
    where: { phone_country: phoneCountry,
      phone_number: phoneNumber,
     }
     , include: userInclude,
  });

const updateCustomerPhone = (userId, phoneCountry, phoneNumber) =>
  prisma.customer.update({
    where: { user_id: userId },
      data: { phone_country: phoneCountry, phone_number: phoneNumber },
  });

const createWithCustomerAndRole = ({ fullName, email, password_hash, phoneCountry, phoneNumber, referralCode }) =>
  prisma.$transaction(async (tx) => {

    const user = await tx.user.create({
      data: {
        full_name: fullName, email, password_hash,
        phone_country: phoneCountry, phone_number: phoneNumber,
        phone_verified_at: new Date(),
        status: 'active', is_active: true,
      },
    });

    await tx.customer.create({
      data: {
        user_id: user.id, name: fullName,
        phone_country: phoneCountry, phone_number: phoneNumber,
        phone_verified_at: new Date(), referral_code: referralCode,
      },
    });

    const clientRole = await tx.role.findFirst({ where: { code: 'client' } });
    if (!clientRole) throw { statusCode: 500, message: 'Rôle client introuvable' };

    await tx.userRole.create({ data: { user_id: user.id, role_id: clientRole.id } });

    return user;
  });

module.exports = {
  findAll,
  findById,
  findByEmail,
  create,
  update,
  remove,
  softDelete,
  updateLastLogin,
  assignRole,
  removeAllRoles,
  findByPhoneNumber,
  updateCustomerPhone,
  createWithCustomerAndRole,
};
