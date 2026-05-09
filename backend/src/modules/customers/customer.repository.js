const prisma = require('../../config/database');

const LIST_SELECT = {
  id: true,
  phone_country: true,
  phone_number: true,
  phone_verified_at: true,
  name: true,
  preferred_lang: true,
  referral_code: true,
  referred_by_id: true,
  wallet_balance: true,
  points_balance: true,
  points_lifetime: true,
  city: true,
  lat: true,
  lng: true,
  is_active: true,
  is_deleted: true,
  deleted_at: true,
  created_at: true,
  updated_at: true,
};

function buildListWhere(query) {
  const where = {};
  const {
    search,
    phone,
    city,
    preferred_lang,
    is_active,
    is_deleted,
    phone_verified,
    has_wallet_balance,
    has_points,
  } = query;

  if (is_deleted === 'true') where.is_deleted = true;
  else if (is_deleted === 'all') {
    /* pas de filtre is_deleted */
  } else {
    where.is_deleted = false;
  }

  if (search && String(search).trim()) {
    const s = String(search).trim();
    where.OR = [
      { name: { contains: s, mode: 'insensitive' } },
      { phone_number: { contains: s, mode: 'insensitive' } },
      { referral_code: { contains: s, mode: 'insensitive' } },
    ];
  }

  if (phone && String(phone).trim()) {
    where.phone_number = { contains: String(phone).trim(), mode: 'insensitive' };
  }

  if (city && String(city).trim()) {
    where.city = { contains: String(city).trim(), mode: 'insensitive' };
  }

  if (preferred_lang === 'fr' || preferred_lang === 'ar') {
    where.preferred_lang = preferred_lang;
  }

  if (is_active === 'true' || is_active === 'false') {
    where.is_active = is_active === 'true';
  }

  if (phone_verified === 'true') {
    where.phone_verified_at = { not: null };
  } else if (phone_verified === 'false') {
    where.phone_verified_at = null;
  }

  if (has_wallet_balance === 'true') {
    where.wallet_balance = { gt: 0 };
  }

  if (has_points === 'true') {
    where.points_balance = { gt: 0 };
  }

  return where;
}

const findManyForList = (query, { skip, take }) => {
  const where = buildListWhere(query);
  return prisma.customer.findMany({
    where,
    orderBy: { created_at: 'desc' },
    skip,
    take,
    select: LIST_SELECT,
  });
};

const countForList = (query) => prisma.customer.count({ where: buildListWhere(query) });

const findByIdWithIncludes = (id) =>
  prisma.customer.findUnique({
    where: { id },
    include: {
      referred_by: { select: { id: true, name: true, referral_code: true, phone_number: true } },
      _count: { select: { orders: true, addresses: true } },
    },
  });

const findActiveByPhone = (phone_country, phone_number, excludeId) =>
  prisma.customer.findFirst({
    where: {
      phone_country,
      phone_number,
      is_deleted: false,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });

const findByReferralCode = (code) =>
  prisma.customer.findFirst({ where: { referral_code: code, is_deleted: false }, select: { id: true } });

const create = (data) => prisma.customer.create({ data, select: LIST_SELECT });

const updateById = (id, data) =>
  prisma.customer.update({
    where: { id },
    data,
    select: LIST_SELECT,
  });

const softDelete = (id) =>
  prisma.customer.update({
    where: { id },
    data: { is_deleted: true, deleted_at: new Date() },
    select: { id: true },
  });

const existsById = (id) =>
  prisma.customer.findFirst({ where: { id, is_deleted: false }, select: { id: true } });

module.exports = {
  LIST_SELECT,
  findManyForList,
  countForList,
  findByIdWithIncludes,
  findActiveByPhone,
  findByReferralCode,
  create,
  updateById,
  softDelete,
  existsById,
};
