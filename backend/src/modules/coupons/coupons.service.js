const prisma = require('../../config/database');
const { PROMO_INCLUDE, formatCoupon } = require('./coupons.shared');
const { notifyCouponCreated } = require('../../utils/notify');


async function resolvePromoTypeId({ promo_type_id, type_code }) {
  if (promo_type_id) return promo_type_id;
  if (type_code) {
    const pt = await prisma.promoType.findUnique({ where: { code: type_code } });
    if (!pt) throw { statusCode: 400, message: `Type de promo inconnu : ${type_code}` };
    return pt.id;
  }
  throw { statusCode: 400, message: 'promo_type_id ou type_code requis' };
}

async function getAll(query = {}) {
  const where = { is_deleted: false };
  if (query.is_active !== undefined) where.is_active = query.is_active === 'true' || query.is_active === true;
  if (query.scope === 'public')   where.customer_id = null;
  if (query.scope === 'personal') where.customer_id = { not: null };
  if (query.code) where.code = { contains: query.code, mode: 'insensitive' };

  const page  = Math.max(1, parseInt(query.page  ?? '1', 10));
  const limit = Math.max(1, parseInt(query.limit ?? '20', 10));
  const skip  = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.promotion.findMany({ where, include: PROMO_INCLUDE, orderBy: { created_at: 'desc' }, skip, take: limit }),
    prisma.promotion.count({ where }),
  ]);

  return {
    data: items.map(formatCoupon),
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

// detail d'un coupon
async function getById(id) {
  const promo = await prisma.promotion.findFirst({
    where: { id, is_deleted: false }, include: PROMO_INCLUDE,
  });
  if (!promo) throw { statusCode: 404, message: 'Coupon introuvable' };
  return formatCoupon(promo);
}

// creer
async function create(body) {
  const {
    code, type_code, promo_type_id,
    value, max_discount, min_order_amount,
    customer_id, node_id,
    uses_max, uses_per_user_max,
    valid_from, valid_to, is_active,
  } = body;

  if (!code) throw { statusCode: 400, message: 'Code requis' };
  if (!valid_from || !valid_to) throw { statusCode: 400, message: 'Dates de validité requises' };
  if (new Date(valid_to) <= new Date(valid_from)) {
    throw { statusCode: 400, message: 'La date de fin doit être après la date de début' };
  }

  const ptId = await resolvePromoTypeId({ promo_type_id, type_code });

  const resolvedType = type_code ?? (promo_type_id
    ? (await prisma.promoType.findUnique({ where: { id: promo_type_id }, select: { code: true } }))?.code
    : null);

  if (resolvedType !== 'FREE_SHIPPING' && Number(value ?? 0) <= 0) {
    throw { statusCode: 400, message: 'La valeur du coupon doit être supérieure à 0' };
  }
  if (resolvedType === 'PERCENTAGE' && Number(value) > 100) {
    throw { statusCode: 400, message: 'Le pourcentage ne peut pas dépasser 100' };
  }

  const exists = await prisma.promotion.findUnique({ where: { code } });
  if (exists) throw { statusCode: 409, message: 'Ce code existe déjà' };

  const created = await prisma.promotion.create({
    data: {
      code:              code.toUpperCase().trim(),
      promo_type_id:     ptId,
      value:             Number(value ?? 0),
      max_discount:      max_discount != null ? Number(max_discount) : null,
      min_order_amount:  Number(min_order_amount ?? 0),
      customer_id:       customer_id ?? null,
      node_id:           node_id ?? null,
      uses_max:          uses_max != null ? Number(uses_max) : null,
      uses_per_user_max: Number(uses_per_user_max ?? 1),
      valid_from:        new Date(valid_from),
      valid_to:          new Date(valid_to),
      is_active:         is_active !== undefined ? !!is_active : true,
    },
    include: PROMO_INCLUDE,
  });

  const formatted = formatCoupon(created);
  notifyCouponCreated(formatted.customer_id, {
    code: formatted.code,
    type: formatted.type,
    value: formatted.value,
    min_order_amount: formatted.min_order_amount,
  }).catch(() => {});

  return formatted;
}

// modifier
async function update(id, body) {
  const existing = await prisma.promotion.findFirst({ where: { id, is_deleted: false } });
  if (!existing) throw { statusCode: 404, message: 'Coupon introuvable' };

  const data = {};
  if (body.value            !== undefined) data.value            = Number(body.value);
  if (body.max_discount     !== undefined) data.max_discount     = body.max_discount != null ? Number(body.max_discount) : null;
  if (body.min_order_amount !== undefined) data.min_order_amount = Number(body.min_order_amount);
  if (body.customer_id      !== undefined) data.customer_id      = body.customer_id ?? null;
  if (body.node_id          !== undefined) data.node_id          = body.node_id ?? null;
  if (body.uses_max         !== undefined) data.uses_max         = body.uses_max != null ? Number(body.uses_max) : null;
  if (body.uses_per_user_max!== undefined) data.uses_per_user_max= Number(body.uses_per_user_max);
  if (body.is_active        !== undefined) data.is_active        = !!body.is_active;
  if (body.valid_from       !== undefined) data.valid_from       = new Date(body.valid_from);
  if (body.valid_to         !== undefined) data.valid_to         = new Date(body.valid_to);

  if (body.type_code !== undefined || body.promo_type_id !== undefined) {
    data.promo_type_id = await resolvePromoTypeId({
      promo_type_id: body.promo_type_id, type_code: body.type_code,
    });
  }

  if (body.code !== undefined && body.code !== existing.code) {
    const dup = await prisma.promotion.findUnique({ where: { code: body.code } });
    if (dup) throw { statusCode: 409, message: 'Ce code existe déjà' };
    data.code = body.code.toUpperCase().trim();
  }

  const start = data.valid_from ?? existing.valid_from;
  const end   = data.valid_to   ?? existing.valid_to;
  if (new Date(end) <= new Date(start)) {
    throw { statusCode: 400, message: 'La date de fin doit être après la date de début' };
  }

  const updated = await prisma.promotion.update({ where: { id }, data, include: PROMO_INCLUDE });
  return formatCoupon(updated);
}

//supprimer
async function remove(id) {
  const existing = await prisma.promotion.findFirst({ where: { id, is_deleted: false } });
  if (!existing) throw { statusCode: 404, message: 'Coupon introuvable' };

  await prisma.promotion.update({
    where: { id },
    data:  { is_deleted: true, deleted_at: new Date(), is_active: false },
  });
  return { id };
}

module.exports = { getAll, getById, create, update, remove };