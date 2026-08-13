const prisma = require('../../../config/database');

const buildWhere = ({ search, status }) => {
  const where = {
    ...(search && {
      OR: [
        { name_fr: { contains: search, mode: 'insensitive' } },
        { name_ar: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description_fr: { contains: search, mode: 'insensitive' } },
        { description_ar: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  if (status === 'deleted') {
    // Onglet/filtre "Supprimé" : uniquement les marques soft-deleted
    where.deleted_at = { not: null };
  } else {
    where.deleted_at = null;
    if (status) where.status = status; // 'active' | 'inactive'
  }

  return where;
};

const findAll = async ({ search, status, page = 1, limit = 20 }) => {
  const where = buildWhere({ search, status });
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const [data, total] = await Promise.all([
    prisma.brand.findMany({ where, skip, take: limitNum, orderBy: { name_fr: 'asc' } }),
    prisma.brand.count({ where }),
  ]);
  return { data, total };
};

const findAll_noPage = () =>
  prisma.brand.findMany({ where: { deleted_at: null, status: 'active' }, orderBy: { name_fr: 'asc' } });

// findById reste strict : on ne peut pas éditer/toggler/supprimer une marque déjà supprimée
const findById = (id) => prisma.brand.findFirst({ where: { id, deleted_at: null } });
const findByCode = (code, excludeId) =>
  prisma.brand.findFirst({
    where: { code, deleted_at: null, ...(excludeId && { NOT: { id: excludeId } }) },
  });
const create = (data) => prisma.brand.create({ data });
const update = (id, data) => prisma.brand.update({ where: { id }, data });
const softDelete = (id) => prisma.brand.update({ where: { id }, data: { deleted_at: new Date() } });

module.exports = { findAll, findAll_noPage, findById, findByCode, create, update, softDelete };