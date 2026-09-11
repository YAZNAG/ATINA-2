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
  // Lignes à préparer : produits seuls et composants (pas d'en-tête de pack, pas de ligne annulée ou remplacée)
  items:         { where: { sku_id: { not: null }, status: { code: { notIn: ['cancelled', 'substituted'] } } }, select: { id: true, qty: true } },
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
          sku: { select: { id: true, name_fr: true, name_ar: true, ean13: true, sku_code: true } },
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


// Depuis la fusion article → sku, les champs sont sur sku. On garde l'alias
// `sku.article` attendu par les écrans picker existants.
const aliasItem = (it) => {
  const sku = it?.order_item?.sku;
  if (sku && !sku.article) sku.article = { id: sku.id, name_fr: sku.name_fr, name_ar: sku.name_ar, ean13: sku.ean13 };
  return it;
};
const aliasSession = (sess) => { if (sess?.items) sess.items.forEach(aliasItem); return sess; };

// ── Mes sessions (par picker) ─────────────────────────────────────────────────
const getMyOrders = async (pickerId) => {
  const rows = await prisma.pickingSession.findMany({
    where:   { picker_id: pickerId },
    include: SESSION_INCLUDE,
    orderBy: { created_at: 'desc' },
  });
  return rows.map(aliasSession);
};

// ── Détail d'une session ──────────────────────────────────────────────────────
const getSessionById = async (sessionId) => {
  return aliasSession(await prisma.pickingSession.findUnique({
    where:   { id: sessionId },
    include: SESSION_INCLUDE,
  }));
};

// ── Item picking avec session incluse ─────────────────────────────────────────
const getItemWithSession = async (itemId) => {
  const it = await prisma.pickingSessionItem.findUnique({
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
          sku:    { select: { id: true, name_fr: true, name_ar: true, ean13: true, sku_code: true } },
          status: { select: { code: true, name_fr: true } },
        },
      },
      status: { select: { code: true, name_fr: true } },
    },
  });
  return aliasItem(it);
};

module.exports = {
  getAvailableOrders,
  getMyOrders,
  getSessionById,
  getItemWithSession,
};
