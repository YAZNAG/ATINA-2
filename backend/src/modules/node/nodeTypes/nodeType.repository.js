const prisma = require('../../../config/database');

const findAll = () => prisma.nodeType.findMany({ orderBy: [{ created_at: 'asc' }] });
const findById = (id) => prisma.nodeType.findUnique({ where: { id } });
const findByCode = (code, excludeId) =>
  prisma.nodeType.findFirst({ where: { code, ...(excludeId && { NOT: { id: excludeId } }) } });
const create = (data) => prisma.nodeType.create({ data });

module.exports = { findAll, findById, findByCode, create };
