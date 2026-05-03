const prisma = require('../../../config/database');

const userAuditSelect = { id: true, full_name: true, email: true };

const buildWhere = ({ search, is_active }) => ({
  is_deleted: false,
  ...(is_active !== undefined && { is_active: is_active === 'true' || is_active === true }),
  ...(search && {
    OR: [
      { name_fr: { contains: search, mode: 'insensitive' } },
      { name_ar: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { description_fr: { contains: search, mode: 'insensitive' } },
      { description_ar: { contains: search, mode: 'insensitive' } },
    ],
  }),
});

const auditInclude = {
  created_by_user: { select: userAuditSelect },
  updated_by_user: { select: userAuditSelect },
  deleted_by_user: { select: userAuditSelect },
};

const findAll = async ({ search, is_active, page = 1, limit = 20 }) => {
  const where = buildWhere({ search, is_active });
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.region.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: [{ name_fr: 'asc' }],
      include: auditInclude,
    }),
    prisma.region.count({ where }),
  ]);
  return { data, total };
};

const findById = (id) =>
  prisma.region.findFirst({
    where: { id, is_deleted: false },
    include: auditInclude,
  });
const findByCode = (code, excludeId) =>
  prisma.region.findFirst({ where: { code, is_deleted: false, ...(excludeId && { NOT: { id: excludeId } }) } });
const create = (data) => prisma.region.create({ data });
const update = (id, data) => prisma.region.update({ where: { id }, data });
const softDelete = (id, deletedById) =>
  prisma.region.update({
    where: { id },
    data: {
      is_deleted: true,
      is_active: false,
      deleted_at: new Date(),
      deleted_by: deletedById,
    },
  });
const countProvinces = (regionId) => prisma.province.count({ where: { region_id: regionId, is_deleted: false } });
const countNodes = (regionId) => prisma.node.count({ where: { region_id: regionId, is_deleted: false } });

module.exports = { findAll, findById, findByCode, create, update, softDelete, countProvinces, countNodes };
