const prisma = require('../config/database');
const {
  getOrderStatusId,
  getPickingStatusId,
  getPickItemStatusId,
} = require('./statusHelpers');

/**
 * createPickingSessionForOrder
 *
 * Fonction partagée utilisée par :
 *  - picker_portal (acceptation par le picker connecté)
 *  - orders_mgmt  (attribution manuelle par admin)
 *
 * @param {string} orderId   - ID de la commande
 * @param {string} pickerId  - ID du picker à affecter
 * @param {string|null} actor - ID de l'acteur (picker.id ou user.id) pour l'historique
 * @param {string} actorLabel - Texte libre pour la note d'historique
 * @returns {Promise<PickingSession>} Session créée avec items inclus
 */
async function createPickingSessionForOrder(orderId, pickerId, actor = null, actorLabel = 'acteur inconnu') {
  // 1. Charger la commande — OrderItem n'a pas de champ is_deleted, filtrer par statut non annulé
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      status: true,
      items:  {
        where: { status: { code: { not: 'cancelled' } } },
        include: { sku: { select: { id: true } } },
      },
    },
  });
  if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
  if (order.status.code !== 'confirmed')
    throw { statusCode: 422, message: `Statut "${order.status.name_fr}" — acceptation impossible (statut requis : confirmed)` };

  // 2. Charger et valider le picker
  const picker = await prisma.picker.findFirst({
    where: { id: pickerId, is_active: true, is_deleted: false },
  });
  if (!picker) throw { statusCode: 404, message: 'Picker introuvable ou inactif' };
  if (picker.node_id !== order.node_id)
    throw { statusCode: 422, message: `Ce picker (${picker.name}) appartient au node ${picker.node_id}, pas au node de la commande` };

  // 3. Vérifier qu'aucune session active n'existe déjà (protection contre double-acceptation)
  const existing = await prisma.pickingSession.findFirst({
    where: { order_id: orderId, status: { code: { in: ['open', 'in_progress'] } } },
  });
  if (existing) throw { statusCode: 409, message: 'Une session picking est déjà en cours pour cette commande' };

  // 4. Résoudre les statuts dynamiquement
  const [openStatusId, pendingItemStatusId, pickingOrderStatusId] = await Promise.all([
    getPickingStatusId('open'),
    getPickItemStatusId('pending'),
    getOrderStatusId('picking'),
  ]);

  // 5. Récupérer les emplacements primaires des SKUs dans ce node
  const skuIds = order.items.filter(i => i.sku_id).map(i => i.sku_id);
  const skuLocations = skuIds.length
    ? await prisma.skuNodeLocation.findMany({
        where: { sku_id: { in: skuIds }, node_id: order.node_id, is_primary_location: true, is_active: true },
        select: { sku_id: true, location_id: true },
      })
    : [];
  const locationMap = Object.fromEntries(skuLocations.map(l => [l.sku_id, l.location_id]));

  // 6. Transaction atomique — empêche double-acceptation par deux pickers simultanés
  const session = await prisma.$transaction(async (tx) => {
    // Re-vérification à l'intérieur de la transaction pour éviter la race condition
    const stillConfirmed = await tx.order.findUnique({
      where: { id: orderId },
      select: { status: { select: { code: true } } },
    });
    if (stillConfirmed.status.code !== 'confirmed')
      throw { statusCode: 409, message: 'Cette commande vient d\'être prise par un autre picker' };

    const activeCheck = await tx.pickingSession.findFirst({
      where: { order_id: orderId, status: { code: { in: ['open', 'in_progress'] } } },
    });
    if (activeCheck)
      throw { statusCode: 409, message: 'Cette commande vient d\'être prise par un autre picker' };

    const newSession = await tx.pickingSession.create({
      data: {
        order_id:  orderId,
        node_id:   order.node_id,
        picker_id: pickerId,
        status_id: openStatusId,
        error_count: 0,
        items: {
          create: order.items.map(item => ({
            order_item_id: item.id,
            status_id:     pendingItemStatusId,
            qty_expected:  item.qty,
            qty_picked:    0,
            location_id:   item.sku_id ? (locationMap[item.sku_id] ?? null) : null,
          })),
        },
      },
    });

    await tx.order.update({
      where: { id: orderId },
      data:  { status_id: pickingOrderStatusId },
    });

    // changed_by expects User.id (Int), but pickers are not Users.
    // We use null and embed actor info in the note.
    await tx.orderHistory.create({
      data: {
        order_id:   orderId,
        status_id:  pickingOrderStatusId,
        changed_by: null,
        note:       `Commande acceptée par ${actorLabel}`,
      },
    });

    return newSession;
  });

  // 7. Socket.IO — notifier les autres pickers que la commande est prise
  try {
    const { emitOrderTaken } = require('../socket/picker.socket');
    emitOrderTaken(order.node_id, {
      order_id:  orderId,
      picker_id: pickerId,
      picker_name: picker.name,
      session_id: session.id,
    });
  } catch (_) { /* Socket optionnel */ }

  // 8. Retourner la session avec détails complets
  return prisma.pickingSession.findUnique({
    where: { id: session.id },
    include: {
      order:  { select: { id: true, total_ttc: true, node_id: true } },
      picker: { select: { id: true, name: true, phone_number: true } },
      status: { select: { code: true, name_fr: true } },
      items: {
        include: {
          status:     { select: { code: true, name_fr: true } },
          location:   { select: { id: true, label: true, aisle: true, shelf: true } },
          order_item: {
            include: {
              sku: {
                include: {
                  article: { select: { id: true, name_fr: true, ean13: true } },
                },
              },
            },
          },
        },
      },
    },
  });
}

module.exports = { createPickingSessionForOrder };
