const prisma = require('../../../config/database');

const buildWhere = ({ search, sku_id }) => ({
  ...(sku_id && { sku_id }),
  ...(search && {
    OR: [
      { url: { contains: search, mode: 'insensitive' } },
      { alt_fr: { contains: search, mode: 'insensitive' } },
      { alt_ar: { contains: search, mode: 'insensitive' } },
    ],
  }),
});

const findAll = async ({ search, sku_id, page = 1, limit = 20 }) => {
  const where = buildWhere({ search, sku_id });
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.skuImage.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: [{ sku_id: 'asc' }, { sort_order: 'asc' }, { created_at: 'desc' }],
      include: { sku: { select: { id: true, created_at: true } } },
    }),
    prisma.skuImage.count({ where }),
  ]);
  return { data, total };
};

const findById = (id) =>
  prisma.skuImage.findUnique({
    where: { id },
    include: { sku: { select: { id: true, created_at: true } } },
  });

const create = (data) => prisma.skuImage.create({ data });
const update = (id, data) => prisma.skuImage.update({ where: { id }, data });
const remove = (id) => prisma.skuImage.delete({ where: { id } });

module.exports = { findAll, findById, create, update, remove };
