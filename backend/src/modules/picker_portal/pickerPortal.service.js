const prisma  = require('../../config/database');
const repo    = require('./pickerPortal.repository');
const { createPickingSessionForOrder } = require('../../utils/createPickingSession.helper');
const { getPickingStatusId, getPickItemStatusId, getOrderStatusId, getOrderItemStatusId } = require('../../utils/statusHelpers');

class PickerPortalService {

  // ── Commandes disponibles ──────────────────────────────────────────────────
  async getAvailableOrders(picker) {
    const orders = await repo.getAvailableOrders(picker.node_id);
    return orders.map(o => ({
      ...o,
      items_count: o.items?.length ?? 0,
      items: undefined,
    }));
  }

  // ── Mes préparations ───────────────────────────────────────────────────────
  async getMyOrders(picker) {
    const sessions = await repo.getMyOrders(picker.id);

    const active    = sessions.filter(s => ['open', 'in_progress'].includes(s.status?.code));
    const completed = sessions.filter(s => s.status?.code === 'completed');
    const cancelled = sessions.filter(s => s.status?.code === 'cancelled');

    const enrich = (s) => ({
      ...s,
      items_count:   s.items?.length ?? 0,
      items_picked:  s.items?.filter(i => i.status?.code !== 'pending').length ?? 0,
    });

    return {
      active:    active.map(enrich),
      completed: completed.map(enrich),
      cancelled: cancelled.map(enrich),
    };
  }

  // ── Accepter une commande ──────────────────────────────────────────────────
  async acceptOrder(orderId, picker) {
    return createPickingSessionForOrder(
      orderId,
      picker.id,
      picker.id,
      `le picker ${picker.name}`
    );
  }

  // ── Détail session ─────────────────────────────────────────────────────────
  async getSession(sessionId) {
    const session = await repo.getSessionById(sessionId);
    if (!session) throw { statusCode: 404, message: 'Session picking introuvable' };
    return session;
  }

  // ── Démarrer session ───────────────────────────────────────────────────────
  async startSession(sessionId, picker) {
    const session = await repo.getSessionById(sessionId);
    if (!session) throw { statusCode: 404, message: 'Session picking introuvable' };
    if (session.picker_id !== picker.id)
      throw { statusCode: 403, message: 'Cette session ne vous appartient pas' };
    if (session.status?.code !== 'open')
      throw { statusCode: 422, message: `Impossible de démarrer une session au statut "${session.status?.name_fr}"` };

    const inProgressId = await getPickingStatusId('in_progress');

    await prisma.pickingSession.update({
      where: { id: sessionId },
      data:  { status_id: inProgressId, started_at: new Date() },
    });

    return repo.getSessionById(sessionId);
  }

  // ── Prélever un article ────────────────────────────────────────────────────
  async pickItem(itemId, { qty_picked, scanned_ean }, picker) {
    const item = await repo.getItemWithSession(itemId);
    if (!item) throw { statusCode: 404, message: 'Article picking introuvable' };
    if (item.session.picker_id !== picker.id)
      throw { statusCode: 403, message: 'Cet article ne fait pas partie de vos sessions' };
    if (item.session.status?.code !== 'in_progress')
      throw { statusCode: 422, message: 'La session doit être en cours (in_progress) pour scanner des articles' };
    if (item.status?.code !== 'pending')
      throw { statusCode: 422, message: `Article déjà traité (statut : ${item.status?.name_fr})` };

    // Validation EAN
    const expectedEan = item.order_item?.sku?.article?.ean13;
    const eanMismatch = expectedEan && scanned_ean && scanned_ean !== expectedEan;

    if (eanMismatch) {
      // Incrémenter error_count et refuser
      await prisma.pickingSession.update({
        where: { id: item.session_id },
        data:  { error_count: { increment: 1 } },
      });
      throw {
        statusCode: 422,
        message:    `EAN incorrect. Attendu : ${expectedEan}. Scanné : ${scanned_ean}`,
        data:       { expected_ean: expectedEan, scanned_ean },
      };
    }

    const pickedStatusId = await getPickItemStatusId('picked');

    await prisma.pickingSessionItem.update({
      where: { id: itemId },
      data: {
        status_id:   pickedStatusId,
        qty_picked:  qty_picked ?? item.qty_expected,
        scanned_ean: scanned_ean ?? null,
        picked_at:   new Date(),
      },
    });

    return repo.getSessionById(item.session_id);
  }

  // ── Déclarer rupture ───────────────────────────────────────────────────────
  async outOfStock(itemId, picker) {
    const item = await repo.getItemWithSession(itemId);
    if (!item) throw { statusCode: 404, message: 'Article picking introuvable' };
    if (item.session.picker_id !== picker.id)
      throw { statusCode: 403, message: 'Cet article ne fait pas partie de vos sessions' };
    if (item.session.status?.code !== 'in_progress')
      throw { statusCode: 422, message: 'La session doit être en cours pour modifier des articles' };
    if (item.status?.code !== 'pending')
      throw { statusCode: 422, message: `Article déjà traité (statut : ${item.status?.name_fr})` };

    const [oosItemStatusId, oosOrderItemStatusId] = await Promise.all([
      getPickItemStatusId('out_of_stock'),
      getOrderItemStatusId('out_of_stock'),
    ]);

    await prisma.$transaction([
      prisma.pickingSessionItem.update({
        where: { id: itemId },
        data:  { status_id: oosItemStatusId },
      }),
      prisma.orderItem.update({
        where: { id: item.order_item_id },
        data:  { status_id: oosOrderItemStatusId },
      }),
      prisma.pickingSession.update({
        where: { id: item.session_id },
        data:  { error_count: { increment: 1 } },
      }),
    ]);

    return repo.getSessionById(item.session_id);
  }

  // ── Substituer un article ──────────────────────────────────────────────────
  async substituteItem(itemId, { substitute_sku_id, qty_picked }, picker) {
    const item = await repo.getItemWithSession(itemId);
    if (!item) throw { statusCode: 404, message: 'Article picking introuvable' };
    if (item.session.picker_id !== picker.id)
      throw { statusCode: 403, message: 'Cet article ne fait pas partie de vos sessions' };
    if (item.session.status?.code !== 'in_progress')
      throw { statusCode: 422, message: 'La session doit être en cours pour modifier des articles' };
    if (item.status?.code !== 'pending')
      throw { statusCode: 422, message: `Article déjà traité (statut : ${item.status?.name_fr})` };

    const [subItemStatusId, subOrderItemStatusId] = await Promise.all([
      getPickItemStatusId('substituted'),
      getOrderItemStatusId('substituted'),
    ]);

    // TODO: stocker substitute_sku_id quand la colonne est ajoutée au schéma Prisma
    await prisma.$transaction([
      prisma.pickingSessionItem.update({
        where: { id: itemId },
        data: {
          status_id:  subItemStatusId,
          qty_picked: qty_picked ?? item.qty_expected,
          picked_at:  new Date(),
        },
      }),
      prisma.orderItem.update({
        where: { id: item.order_item_id },
        data:  { status_id: subOrderItemStatusId },
      }),
      prisma.pickingSession.update({
        where: { id: item.session_id },
        data:  { error_count: { increment: 1 } },
      }),
    ]);

    return repo.getSessionById(item.session_id);
  }

  // ── Terminer session ───────────────────────────────────────────────────────
  async completeSession(sessionId, picker) {
    const session = await repo.getSessionById(sessionId);
    if (!session) throw { statusCode: 404, message: 'Session picking introuvable' };
    if (session.picker_id !== picker.id)
      throw { statusCode: 403, message: 'Cette session ne vous appartient pas' };
    if (session.status?.code !== 'in_progress')
      throw { statusCode: 422, message: `Impossible de terminer une session au statut "${session.status?.name_fr}"` };

    // Vérifier qu'aucun item n'est encore pending
    const pendingItems = session.items?.filter(i => i.status?.code === 'pending') ?? [];
    if (pendingItems.length > 0)
      throw {
        statusCode: 422,
        message:    `Tous les articles doivent être traités avant de terminer la préparation. (${pendingItems.length} article(s) en attente)`,
      };

    const [completedSessionId, readyOrderId] = await Promise.all([
      getPickingStatusId('completed'),
      getOrderStatusId('ready'),
    ]);

    await prisma.$transaction(async (tx) => {
      await tx.pickingSession.update({
        where: { id: sessionId },
        data:  { status_id: completedSessionId, completed_at: new Date() },
      });

      await tx.order.update({
        where: { id: session.order_id },
        data:  { status_id: readyOrderId },
      });

      await tx.orderHistory.create({
        data: {
          order_id:   session.order_id,
          status_id:  readyOrderId,
          changed_by: picker.id,
          note:       `Préparation terminée par le picker ${picker.name}`,
        },
      });
    });

    return repo.getSessionById(sessionId);
  }
}

module.exports = new PickerPortalService();
