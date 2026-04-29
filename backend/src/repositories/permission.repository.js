const prisma = require('../config/database');

const findAll = () =>
  prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] });

const findById = (id) =>
  prisma.permission.findUnique({ where: { id } });

const findByIds = (ids) =>
  prisma.permission.findMany({ where: { id: { in: ids } } });

const create = (data) =>
  prisma.permission.create({ data });

module.exports = { findAll, findById, findByIds, create };
