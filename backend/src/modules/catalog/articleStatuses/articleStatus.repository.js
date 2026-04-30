const prisma = require('../../../config/database');

const buildWhere = ({ search }) => ({
  ...(search && {
    OR: [
      { name_fr: { contains: search, mode: 'insensitive' } },
      { name_ar: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ],
  }),
});

const findAll = async ({ search, page = 1, limit = 20 }) => {
  const where = buildWhere({ search });
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.articleStatus.findMany({ where, skip, take: limitNum, orderBy: { name_fr: 'asc' } }),
    prisma.articleStatus.count({ where }),
  ]);
  return { data, total };
};

const findAll_noPage = () => prisma.articleStatus.findMany({ orderBy: { name_fr: 'asc' } });
const findById = (id) => prisma.articleStatus.findUnique({ where: { id } });
const findByCode = (code, excludeId) =>
  prisma.articleStatus.findFirst({ where: { code, ...(excludeId && { NOT: { id: excludeId } }) } });
const create = (data) => prisma.articleStatus.create({ data });
const update = (id, data) => prisma.articleStatus.update({ where: { id }, data });
const remove = (id) => prisma.articleStatus.delete({ where: { id } });

module.exports = { findAll, findAll_noPage, findById, findByCode, create, update, remove };
