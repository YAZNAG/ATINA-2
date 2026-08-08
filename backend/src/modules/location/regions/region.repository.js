const prisma = require('../../../config/database');

const buildWhere = ({ search, is_active, is_deleted }) => ({
  ...(is_deleted !== undefined && { is_deleted: is_deleted === 'true' || is_deleted === true }),
  ...(is_active !== undefined && { is_active: is_active === 'true' || is_active === true }),
  ...(search && {
    OR: [
      { name_fr: { contains: search, mode: 'insensitive' } },
      { name_ar: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ],
  }),
});

const findAll = async ({ search, is_active, is_deleted, page = 1, limit = 20 }) => {
  const where = buildWhere({ search, is_active, is_deleted });
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.region.findMany({ where, skip, take: limitNum, orderBy: { name_fr: 'asc' } }),
    prisma.region.count({ where }),
  ]);
  return { data, total };
};

const findById = (id) => prisma.region.findFirst({ where: { id, is_deleted: false } });

const findByCode = (code, excludeId) =>
  prisma.region.findFirst({
    where: { code, is_deleted: false, ...(excludeId && { NOT: { id: excludeId } }) },
  });

const create = (data) => prisma.region.create({ data });
const update = (id, data) => prisma.region.update({ where: { id }, data });

const countProvinces = (regionId) =>
  prisma.province.count({ where: { region_id: regionId, is_deleted: false } });

const countCities = (regionId) =>
  prisma.city.count({
    where: { is_deleted: false, province: { region_id: regionId, is_deleted: false } },
  });

// ⚠️ Adapte le nom du champ FK sur Node si ce n'est pas region_id chez toi
const countNodes = (regionId) =>
  prisma.node.count({ where: { region_id: regionId, is_deleted: false } });

/**
 * Soft-delete en cascade : région -> ses provinces -> les villes de ces provinces.
 * Tout dans une transaction Prisma pour éviter un état intermédiaire incohérent
 * (ex: villes supprimées mais province qui reste active).
 */
const softDeleteCascade = async (regionId, userId) => {
  return prisma.$transaction(async (tx) => {
    const provinces = await tx.province.findMany({
      where: { region_id: regionId, is_deleted: false },
      select: { id: true },
    });
    const provinceIds = provinces.map((p) => p.id);

    let cityCount = 0;
    if (provinceIds.length > 0) {
      const cityResult = await tx.city.updateMany({
        where: { province_id: { in: provinceIds }, is_deleted: false },
        data: { is_deleted: true, is_active: false },
      });
      cityCount = cityResult.count;
    }

    const provinceResult = await tx.province.updateMany({
      where: { region_id: regionId, is_deleted: false },
      data: { is_deleted: true, is_active: false },
    });

    await tx.region.update({
      where: { id: regionId },
      data: {
        is_deleted: true,
        is_active: false,
        deleted_at: new Date(),
        deleted_by: userId ?? null,
      },
    });

    return { province_count: provinceResult.count, city_count: cityCount };
  });
};

module.exports = {
  findAll,
  findById,
  findByCode,
  create,
  update,
  countProvinces,
  countCities,
  countNodes,
  softDeleteCascade,
};