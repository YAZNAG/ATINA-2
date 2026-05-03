const prisma = require('../../../config/database');

const findAll = async ({ page = 1, limit = 20 }) => {
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.sku.findMany({
      skip,
      take: limitNum,
      orderBy: { created_at: 'desc' },
      include: { _count: { select: { images: true } } },
    }),
    prisma.sku.count(),
  ]);
  return { data, total };
};

const findAllFlat = () =>
  prisma.sku.findMany({
    orderBy: { created_at: 'desc' },
    select: { id: true, created_at: true },
  });

const findById = (id) =>
  prisma.sku.findUnique({
    where: { id },
    include: { images: { orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }] } },
  });

const create = (data) => prisma.sku.create({ data });
const remove = (id) => prisma.sku.delete({ where: { id } });

module.exports = { findAll, findAllFlat, findById, create, remove };
