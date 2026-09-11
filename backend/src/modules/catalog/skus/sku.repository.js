const prisma = require('../../../config/database');

const BASE_WHERE = { deleted_at: null, is_deleted: false };

const INCLUDE = {
  sku_family: { select: { id: true, name_fr: true, name_ar: true } },
  sku_subfamily: { select: { id: true, name_fr: true, name_ar: true } },
  category: { select: { id: true, name_fr: true, name_ar: true } },
  brand: { select: { id: true, name_fr: true, name_ar: true } },
  images: {
    where: { deleted_at: null },
    orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }, { id: 'asc' }],
    take: 1,
    select: { url: true, is_primary: true },
  },
  unit_purchase_ref: { select: { id: true, name_fr: true, code: true } },
  unit_sale_ref: { select: { id: true, name_fr: true, code: true } },
  packaging_type: { select: { id: true, name_fr: true, code: true, quantity: true } },
  sku_status: { select: { id: true, code: true, name_fr: true, name_ar: true } },
};

const SKU_STATUS_CODES = ['draft', 'active', 'inactive', 'discontinued'];

const buildWhere = ({ search, status, status_id, status_code, sku_status, sku_family_id, sku_subfamily_id, category_id, brand_id }) => {
  let base;
  if (status === 'deleted') {
    base = { deleted_at: { not: null } };
  } else if (status === 'active') {
    base = { deleted_at: null, is_deleted: false, is_active: true };
  } else if (status === 'inactive') {
    base = { deleted_at: null, is_deleted: false, is_active: false };
  } else {
    base = { deleted_at: null, is_deleted: false };
  }
  // Filtre par statut du référentiel sku_statuses (uuid ou code).
  const code = status_code || sku_status || (['draft', 'discontinued'].includes(status) ? status : null);
  if (status_id) base.status_id = String(status_id);
  else if (code && SKU_STATUS_CODES.includes(String(code))) base.sku_status = { code: String(code) };

  return {
    ...base,
    ...(sku_family_id && { sku_family_id: String(sku_family_id) }),
    ...(sku_subfamily_id && { sku_subfamily_id: String(sku_subfamily_id) }),
    ...(category_id && { category_id: String(category_id) }),
    ...(brand_id && { brand_id: Number(brand_id) }),
    ...(search && {
      OR: [
        { name_fr: { contains: search, mode: 'insensitive' } },
        { name_ar: { contains: search, mode: 'insensitive' } },
        { sku_code: { contains: search, mode: 'insensitive' } },
        { ean13: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };
};

const findByIdIncludingDeleted = async (id) => {
  return prisma.sku.findUnique({ where: { id }, include: INCLUDE });
};

const restore = async (id) => {
  return prisma.sku.update({ where: { id }, data: { deleted_at: null, is_deleted: false } });
};

const findAll = async (params) => {
  const { page = 1, limit = 20, ...filters } = params;
  const where = buildWhere(filters);
  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    prisma.sku.findMany({ where, skip, take: Number(limit), include: INCLUDE, orderBy: { created_at: 'desc' } }),
    prisma.sku.count({ where }),
  ]);

  return { data, total };
};

const findById = async (id) => {
  return prisma.sku.findFirst({ where: { id, ...BASE_WHERE }, include: INCLUDE });
};

/** `select: { id: true }` uniquement : évite un `SELECT *` inutile pour une simple vérification d'unicité. */
const findBySkuCode = async (sku_code, excludeId) => {
  return prisma.sku.findFirst({
    where: { sku_code, ...BASE_WHERE, ...(excludeId && { NOT: { id: excludeId } }) },
    select: { id: true },
  });
};
const findByEan13 = async (ean13, excludeId) => {
  return prisma.sku.findFirst({
    where: { ean13, ...BASE_WHERE, ...(excludeId && { NOT: { id: excludeId } }) },
    select: { id: true },
  });
};

const create = async (data) => {
  return prisma.sku.create({ data, include: INCLUDE });
};
const update = async (id, data) => {
  return prisma.sku.update({ where: { id }, data, include: INCLUDE });
};
/** Références actives au SKU : lignes de packs non supprimés et flash sales non supprimées. */
const countUsages = async (id) => {
  const [packs, flashSales] = await Promise.all([
    prisma.packItem.count({ where: { sku_id: id, pack: { is_deleted: false } } }),
    prisma.flashSale.count({ where: { sku_id: id, is_deleted: false } }),
  ]);
  return { packs, flashSales };
};

const softDelete = async (id) => {
  return prisma.sku.update({
    where: { id },
    data: { deleted_at: new Date(), is_active: false, is_deleted: true },
  });
};

module.exports = {
  findAll,
  findById,
  findByIdIncludingDeleted,
  findBySkuCode,
  findByEan13,
  create,
  update,
  softDelete,
  countUsages,
  restore,
  INCLUDE,
};