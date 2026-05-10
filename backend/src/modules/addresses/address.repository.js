const prisma = require('../../config/database');

const ACTIVE_WHERE = { is_deleted: false };

const findAllByCustomer = (customer_id) =>
  prisma.address.findMany({
    where: { customer_id, is_deleted: false },
    orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
  });

const findById = (id) =>
  prisma.address.findUnique({ where: { id } });

const findDefaultByCustomer = (customer_id) =>
  prisma.address.findFirst({ where: { customer_id, is_default: true, is_deleted: false } });

const create = (data) => prisma.address.create({ data });

const update = (id, data) =>
  prisma.address.update({ where: { id }, data });

// Unset all defaults for customer then set the target
const setDefault = async (id, customer_id) => {
  await prisma.address.updateMany({
    where: { customer_id, is_default: true },
    data:  { is_default: false },
  });
  return prisma.address.update({ where: { id }, data: { is_default: true } });
};

const softDelete = (id) =>
  prisma.address.update({
    where: { id },
    data:  { is_deleted: true, deleted_at: new Date(), is_default: false },
  });

module.exports = { findAllByCustomer, findById, findDefaultByCustomer, create, update, setDefault, softDelete };
