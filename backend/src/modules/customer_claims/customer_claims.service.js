const prisma = require('../../config/database');

const VALID_TYPES = [
  'MISSING_PRODUCT',  
  'DAMAGED_PRODUCT',   
  'WRONG_PRODUCT',     
  'REFUND_REQUEST',   
  'OTHER',            
];

const TYPE_LABELS = {
  MISSING_PRODUCT: 'Produit manquant',
  DAMAGED_PRODUCT: 'Produit abîmé',
  WRONG_PRODUCT:   'Mauvais produit reçu',
  REFUND_REQUEST:  'Demande de remboursement',
  OTHER:           'Autre',
};

const STATUS_LABELS = {
  OPEN:        'Ouverte',
  IN_PROGRESS: 'En cours',
  RESOLVED:    'Résolue',
  CLOSED:      'Fermée',
};

const CLAIM_INCLUDE = {
  order: {
    select: {
      id: true,
      created_at: true,
      total_ttc: true,
      status: { select: { name_fr: true, color: true } },
    },
  },
};

function formatClaim(c) {
  return {
    id:           c.id,
    type:         c.type,
    type_label:   TYPE_LABELS[c.type] ?? c.type,
    status:       c.status,
    status_label: STATUS_LABELS[c.status] ?? c.status,
    description:  c.description,
    admin_note:   c.admin_note ?? null,
    resolved_at:  c.resolved_at ?? null,
    created_at:   c.created_at,
    updated_at:   c.updated_at,
    order: c.order ? {
      id:        c.order.id,
      reference: c.order.id.slice(0, 8).toUpperCase(),
      total_ttc: Number(c.order.total_ttc ?? 0),
      status:    c.order.status,
    } : null,
  };
}

// lister mes reclamations
async function listMyClaims(customerId, query = {}) {
  const where = { customer_id: customerId, is_deleted: false };
  if (query.status) where.status = query.status;

  const page  = Math.max(1, parseInt(query.page  ?? '1', 10));
  const limit = Math.max(1, parseInt(query.limit ?? '10', 10));
  const skip  = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.claim.findMany({
      where, include: CLAIM_INCLUDE,
      orderBy: { created_at: 'desc' },
      skip, take: limit,
    }),
    prisma.claim.count({ where }),
  ]);

  return {
    data: items.map(formatClaim),
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

// detail d'une reclamation 
async function getMyClaimById(customerId, claimId) {
  const claim = await prisma.claim.findFirst({
    where:   { id: claimId, customer_id: customerId, is_deleted: false },
    include: CLAIM_INCLUDE,
  });
  if (!claim) throw { statusCode: 404, message: 'Réclamation introuvable' };
  return formatClaim(claim);
}

// creer une reclamation ─────────────────────────────────────────────────────
async function createClaim(customerId, body) {
  const { order_id, type, description } = body;

  if (!order_id)    throw { statusCode: 400, message: 'order_id requis' };
  if (!type)        throw { statusCode: 400, message: 'Type de réclamation requis' };
  if (!VALID_TYPES.includes(type))
    throw { statusCode: 400, message: `Type invalide. Valeurs : ${VALID_TYPES.join(', ')}` };
  if (!description?.trim())
    throw { statusCode: 400, message: 'Description requise' };

  const order = await prisma.order.findFirst({
    where: { id: order_id, customer_id: customerId, is_deleted: false },
  });
  if (!order) throw { statusCode: 404, message: 'Commande introuvable' };

  const existing = await prisma.claim.findFirst({
    where: {
      customer_id: customerId,
      order_id,
      type,
      is_deleted: false,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
  });
  if (existing)
    throw { statusCode: 409, message: 'Une réclamation de ce type est déjà en cours pour cette commande' };

  const created = await prisma.claim.create({
    data: {
      customer_id: customerId,
      order_id,
      type,
      description: description.trim(),
      status: 'OPEN',
    },
    include: CLAIM_INCLUDE,
  });

  return formatClaim(created);
}

//annuler une reclamation (si encore OPEN) 
async function cancelClaim(customerId, claimId) {
  const claim = await prisma.claim.findFirst({
    where: { id: claimId, customer_id: customerId, is_deleted: false },
  });
  if (!claim) throw { statusCode: 404, message: 'Réclamation introuvable' };
  if (claim.status !== 'OPEN')
    throw { statusCode: 400, message: 'Seules les réclamations ouvertes peuvent être annulées' };

  await prisma.claim.update({
    where: { id: claimId },
    data:  { is_deleted: true, deleted_at: new Date() },
  });
  return { id: claimId };
}

module.exports = { listMyClaims, getMyClaimById, createClaim, cancelClaim, VALID_TYPES, TYPE_LABELS };