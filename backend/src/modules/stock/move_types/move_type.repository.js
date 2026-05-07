const prisma = require('../../../config/database');

const buildWhere = ({ search, operation } = {}) => ({
  ...(operation && { operation }),
  ...(search && {
    OR: [
      { code: { contains: search, mode: 'insensitive' } },
      { name_fr: { contains: search, mode: 'insensitive' } },
      { name_ar: { contains: search, mode: 'insensitive' } },
    ],
  }),
});

const findAll = async ({ page = 1, limit = 20, all, ...filters } = {}) => {
  const where = buildWhere(filters);
  if (all === 'true' || all === true) {
    const data = await prisma.moveType.findMany({ where, orderBy: [{ name_fr: 'asc' }] });
    return { data, total: data.length };
  }
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const [data, total] = await Promise.all([
    prisma.moveType.findMany({ where, skip: (pageNum - 1) * limitNum, take: limitNum, orderBy: [{ name_fr: 'asc' }] }),
    prisma.moveType.count({ where }),
  ]);
  return { data, total };
};

const findById = (id) => prisma.moveType.findUnique({ where: { id } });
const findByCode = (code, excludeId) =>
  prisma.moveType.findFirst({ where: { code, ...(excludeId && { NOT: { id: excludeId } }) } });
const create = (data) => prisma.moveType.create({ data });
const update = (id, data) => prisma.moveType.update({ where: { id }, data });
const remove = (id) => prisma.moveType.delete({ where: { id } });

module.exports = { findAll, findById, findByCode, create, update, remove };
