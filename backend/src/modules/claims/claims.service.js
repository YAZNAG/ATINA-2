const prisma = require('../../config/database');

const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const ADMIN_INCLUDE = {
  customer: { select: { id: true, name: true, phone_number: true, phone_country: true } },
  order:    {
    select: {
      id: true, created_at: true, total_ttc: true,
      status: { select: { name_fr: true, color: true } },
    },
  },
};

function formatClaim(c) {
  return {
    id:           c.id,
    type:         c.type,
    status:       c.status,
    description:  c.description,
    admin_note:   c.admin_note ?? null,
    resolved_at:  c.resolved_at ?? null,
    created_at:   c.created_at,
    updated_at:   c.updated_at,
    customer: c.customer,
    order: c.order ? {
      id:        c.order.id,
      reference: c.order.id.slice(0, 8).toUpperCase(),
      total_ttc: Number(c.order.total_ttc ?? 0),
      status:    c.order.status,
    } : null,
  };
}

async function getAll(query = {}) {
  const where = { is_deleted: false };
  if (query.status)     where.status     = query.status;
  if (query.type)       where.type       = query.type;
  if (query.order_id)   where.order_id   = query.order_id;
  if (query.customer_id) where.customer_id = query.customer_id;

  const page  = Math.max(1, parseInt(query.page  ?? '1', 10));
  const limit = Math.max(1, parseInt(query.limit ?? '20', 10));
  const skip  = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.claim.findMany({ where, include: ADMIN_INCLUDE, orderBy: { created_at: 'desc' }, skip, take: limit }),
    prisma.claim.count({ where }),
  ]);

  return {
    data: items.map(formatClaim),
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

// detail 
async function getById(id) {
  const claim = await prisma.claim.findFirst({ where: { id, is_deleted: false }, include: ADMIN_INCLUDE });
  if (!claim) throw { statusCode: 404, message: 'Réclamation introuvable' };
  return formatClaim(claim);
}

// mettre a jour le statut + note admin 
async function updateStatus(id, body) {
  const { status, admin_note } = body;
  const existing = await prisma.claim.findFirst({ where: { id, is_deleted: false } });
  if (!existing) throw { statusCode: 404, message: 'Réclamation introuvable' };

  if (status && !VALID_STATUSES.includes(status))
    throw { statusCode: 400, message: `Statut invalide. Valeurs : ${VALID_STATUSES.join(', ')}` };

  const data = {};
  if (status)     data.status     = status;
  if (admin_note !== undefined) data.admin_note = admin_note;
  if (status === 'RESOLVED' || status === 'CLOSED')
    data.resolved_at = new Date();

  const updated = await prisma.claim.update({ where: { id }, data, include: ADMIN_INCLUDE });
  return formatClaim(updated);
}

module.exports = { getAll, getById, updateStatus };