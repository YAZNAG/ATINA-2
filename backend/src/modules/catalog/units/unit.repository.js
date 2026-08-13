const prisma = require('../../../config/database');

const BASE_WHERE = { deleted_at: null };

const buildWhere = ({ search, status }) => {
  const base =
    status === 'deleted'
      ? { deleted_at: { not: null } }
      : { deleted_at: null, ...(status && status !== 'all' && { status }) };
  return {
    ...base,
    ...(search && {
      OR: [
        { name_fr: { contains: search, mode: 'insensitive' } },
        { name_ar: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };
};

const findAll = async ({ search, status, page = 1, limit = 20 }) => {
  const where = buildWhere({ search, status });
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.unit.findMany({
      where,
      skip,
      take: limitNum,
      include: { _count: { select: { packaging_types: { where: { deleted_at: null } } } } },
      orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }],
    }),
    prisma.unit.count({ where }),
  ]);
  return { data, total };
};

const findAll_noPage = () =>
  prisma.unit.findMany({ where: { ...BASE_WHERE, status: 'active' }, orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }] });

const findById = (id) =>
  prisma.unit.findFirst({
    where: { id, ...BASE_WHERE },
    include: { _count: { select: { packaging_types: { where: { deleted_at: null } } } } },
  });
const findByIdIncludingDeleted = (id) => prisma.unit.findUnique({ where: { id } });

const findByCode = (code, excludeId) =>
  prisma.unit.findFirst({ where: { code, ...BASE_WHERE, ...(excludeId && { NOT: { id: excludeId } }) } });

const create = (data) => prisma.unit.create({ data });
const update = (id, data) => prisma.unit.update({ where: { id }, data });
const softDelete = (id) => prisma.unit.update({ where: { id }, data: { deleted_at: new Date() } });
const restore = (id) => prisma.unit.update({ where: { id }, data: { deleted_at: null } });

/** items: [{ id, sort_order }] — réordonnancement en masse via transaction */
const reorder = (items) =>
  prisma.$transaction(
    items.map(({ id, sort_order }) =>
      prisma.unit.update({ where: { id: Number(id) }, data: { sort_order: Number(sort_order) } })
    )
  );

module.exports = {
  findAll, findAll_noPage, findById, findByIdIncludingDeleted, findByCode,
  create, update, softDelete, restore, reorder,
};