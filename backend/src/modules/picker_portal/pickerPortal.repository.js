const prisma = require('../../config/database');

// ── Sélecteurs réutilisables ──────────────────────────────────────────────────
const ORDER_SELECT = {
  id:          true,
  total_ttc:   true,
  created_at:  true,
  node_id:     true,
  status:        { select: { code: true, name_fr: true } },
  delivery_type: { select: { code: true, name_fr: true } },
  customer:      { select: { id: true, name: true, phone_number: true } },
  items:         { where: { status: { code: { not: 'cancelled' } } }, select: { id: true, qty: true } },
  confirmed_slot: { select: { slot_start: true, slot_end: true } },
};

const SESSION_INCLUDE = {
  status: { select: { code: true, name_fr: true } },
  order: {
    select: {
      id: true, total_ttc: true, created_at: true,
      customer:       { select: { id: true, name: true } },
      status:         { select: { code: true, name_fr: true } },
      confirmed_slot: { select: { slot_start: true, slot_end: true } },
    },
  },
  items: {
    include: {
      status:   { select: { code: true, name_fr: true } },
      location: { select: { id: true, label: true, aisle: true, shelf: true } },
      order_item: {
        include: {
          sku: {
            include: {
              article: { select: { id: true, name_fr: true, ean13: true } },
            },
          },
          status: { select: { code: true, name_fr: true } },
        },
      },
    },
  },
};

// ── Commandes disponibles pour un node (status=confirmed, sans session active) ──
const getAvailableOrders = async (nodeId) => {
  return prisma.order.findMany({
    where: {
      node_id:    nodeId,
      is_deleted: false,
      status:     { code: 'confirmed' },
      // Exclure commandes déjà avec session active (open ou in_progress)
      NOT: {
        picking_sessions: {
          some: { status: { code: { in: ['open', 'in_progress'] } } },
        },
      },
    },
    select:  ORDER_SELECT,
    orderBy: { created_at: 'asc' },
  });
};

// ── Mes sessions (par picker) ─────────────────────────────────────────────────
const getMyOrders = async (pickerId) => {
  return prisma.pickingSession.findMany({
    where:   { picker_id: pickerId },
    include: SESSION_INCLUDE,
    orderBy: { created_at: 'desc' },
  });
};

// ── Détail d'une session ──────────────────────────────────────────────────────
const getSessionById = async (sessionId) => {
  return prisma.pickingSession.findUnique({
    where:   { id: sessionId },
    include: SESSION_INCLUDE,
  });
};

// ── Item picking avec session incluse ─────────────────────────────────────────
const getItemWithSession = async (itemId) => {
  return prisma.pickingSessionItem.findUnique({
    where: { id: itemId },
    include: {
      session: {
        select: {
          id:        true,
          order_id:  true,
          node_id:   true,
          picker_id: true,
          status:    { select: { code: true, name_fr: true } },
        },
      },
      order_item: {
        include: {
          sku:    { include: { article: { select: { id: true, name_fr: true, ean13: true } } } },
          status: { select: { code: true, name_fr: true } },
        },
      },
      status: { select: { code: true, name_fr: true } },
    },
  });
};

module.exports = {
  getAvailableOrders,
  getMyOrders,
  getSessionById,
  getItemWithSession,
};
