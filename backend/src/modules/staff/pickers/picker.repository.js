const prisma = require('../../../config/database');

const SELECT = { id: true, node_id: true, phone_country: true, phone_number: true, name: true, is_active: true, is_deleted: true, deleted_at: true, created_by: true, created_at: true, updated_at: true, node: { select: { id: true, code: true, name_fr: true } } };

const buildWhere = ({ node_id, is_active, search } = {}) => {
  const w = { is_deleted: false };
  if (node_id)  w.node_id   = node_id;
  if (is_active !== undefined && is_active !== '') w.is_active = is_active === 'true' || is_active === true;
  if (search?.trim()) w.OR = [{ name: { contains: search, mode: 'insensitive' } }, { phone_number: { contains: search } }];
  return w;
};

const findAll = async ({ page = 1, limit = 25, ...filters } = {}) => {
  const where = buildWhere(filters);
  const [data, total] = await Promise.all([
    prisma.picker.findMany({ where, select: SELECT, orderBy: { created_at: 'desc' }, skip: (page-1)*limit, take: limit }),
    prisma.picker.count({ where }),
  ]);
  return { data, total };
};

const findById   = (id) => prisma.picker.findUnique({ where: { id }, select: { ...SELECT, password_hash: true } });
const findByPhone = (phone_country, phone_number) =>
  prisma.picker.findFirst({ where: { phone_country, phone_number, is_deleted: false }, select: { ...SELECT, password_hash: true } });

const create = (data) => prisma.picker.create({ data, select: SELECT });
const update = (id, data) => prisma.picker.update({ where: { id }, data, select: SELECT });
const softDelete = (id) => prisma.picker.update({ where: { id }, data: { is_deleted: true, is_active: false, deleted_at: new Date() }, select: SELECT });

module.exports = { findAll, findById, findByPhone, create, update, softDelete };
