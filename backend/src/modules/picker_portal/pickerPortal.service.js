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

    const [inProgressId, pickingStatusRow] = await Promise.all([
      getPickingStatusId('in_progress'),
      prisma.orderStatus.findFirst({ where: { code: 'picking' } }),
    ]);

    await prisma.$transaction(async (tx) => {
      await tx.pickingSession.update({
        where: { id: sessionId },
        data:  { status_id: inProgressId, started_at: new Date() },
      });
      if (pickingStatusRow) {
        await tx.orderHistory.create({
          data: {
            order_id:   session.order_id,
            status_id:  pickingStatusRow.id,
            changed_by: null, // picker.id is UUID, not Int (User.id)
            note:       `Préparation démarrée par le picker ${picker.name}`,
          },
        });
      }
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
  async outOfStock(itemId, { reason } = {}, picker) {
    const item = await repo.getItemWithSession(itemId);
    if (!item) throw { statusCode: 404, message: 'Article picking introuvable' };
    if (item.session.picker_id !== picker.id)
      throw { statusCode: 403, message: 'Cet article ne fait pas partie de vos sessions' };
    if (item.session.status?.code !== 'in_progress')
      throw { statusCode: 422, message: 'La session doit être en cours pour modifier des articles' };
    if (item.status?.code !== 'pending')
      throw { statusCode: 422, message: `Article déjà traité (statut : ${item.status?.name_fr})` };

    const [oosItemStatusId, oosOrderItemStatusId, pickingStatusRow] = await Promise.all([
      getPickItemStatusId('out_of_stock'),
      getOrderItemStatusId('out_of_stock'),
      prisma.orderStatus.findFirst({ where: { code: 'picking' } }),
    ]);

    const articleName = item.order_item?.sku?.article?.name_fr ?? 'Article';

    await prisma.$transaction(async (tx) => {
      await tx.pickingSessionItem.update({
        where: { id: itemId },
        data:  { status_id: oosItemStatusId, qty_picked: 0 },
      });
      await tx.orderItem.update({
        where: { id: item.order_item_id },
        data:  { status_id: oosOrderItemStatusId },
      });
      await tx.pickingSession.update({
        where: { id: item.session_id },
        data:  { error_count: { increment: 1 } },
      });
      if (pickingStatusRow) {
        await tx.orderHistory.create({
          data: {
            order_id:   item.session.order_id,
            status_id:  pickingStatusRow.id,
            changed_by: null,
            note:       `Rupture déclarée par ${picker.name} — "${articleName}"${reason ? ' : ' + reason : ''}`,
          },
        });
      }
    });

    return repo.getSessionById(item.session_id);
  }

  // ── Substituer un article ──────────────────────────────────────────────────
  async substituteItem(itemId, { substitute_sku_id, substitute_ean, qty_picked, reason }, picker) {
    const item = await repo.getItemWithSession(itemId);
    if (!item) throw { statusCode: 404, message: 'Article picking introuvable' };
    if (item.session.picker_id !== picker.id)
      throw { statusCode: 403, message: 'Cet article ne fait pas partie de vos sessions' };
    if (item.session.status?.code !== 'in_progress')
      throw { statusCode: 422, message: 'La session doit être en cours pour modifier des articles' };
    if (item.status?.code !== 'pending')
      throw { statusCode: 422, message: `Article déjà traité (statut : ${item.status?.name_fr})` };

    // Résoudre le SKU substitut : par ID ou par EAN
    let resolvedSkuId = substitute_sku_id ?? null;
    if (!resolvedSkuId && substitute_ean) {
      const skuByEan = await prisma.sku.findFirst({
        where: { article: { ean13: substitute_ean }, stock_levels: { some: { node_id: item.session.node_id } } },
        select: { id: true, article: { select: { name_fr: true, ean13: true } } },
      });
      if (!skuByEan) throw { statusCode: 404, message: `Aucun SKU trouvé avec l'EAN ${substitute_ean} dans ce node` };
      resolvedSkuId = skuByEan.id;
    }

    // Valider le SKU substitut s'il est fourni
    let substituteName = null;
    if (resolvedSkuId) {
      const subSku = await prisma.sku.findUnique({
        where: { id: resolvedSkuId },
        include: {
          article: { select: { name_fr: true, is_active: true } },
          stock_levels: { where: { node_id: item.session.node_id } },
        },
      });
      if (!subSku) throw { statusCode: 404, message: 'SKU substitut introuvable' };
      if (!subSku.article?.is_active) throw { statusCode: 422, message: 'Le produit substitut est inactif' };

      const stockLevel = subSku.stock_levels[0];
      const avail      = stockLevel ? Number(stockLevel.qty_available) : 0;
      const needed     = Number(qty_picked ?? 1);
      if (avail < needed) throw { statusCode: 422, message: `Stock insuffisant pour le substitut (disponible: ${avail})` };

      substituteName = subSku.article?.name_fr;
    }

    const [subItemStatusId, subOrderItemStatusId, pickingStatusRow] = await Promise.all([
      getPickItemStatusId('substituted'),
      getOrderItemStatusId('substituted'),
      prisma.orderStatus.findFirst({ where: { code: 'picking' } }),
    ]);

    const originalName = item.order_item?.sku?.article?.name_fr ?? 'Article';

    await prisma.$transaction(async (tx) => {
      await tx.pickingSessionItem.update({
        where: { id: itemId },
        data: {
          status_id:         subItemStatusId,
          qty_picked:        qty_picked ?? item.qty_expected,
          picked_at:         new Date(),
          substitute_sku_id: resolvedSkuId ?? undefined,
        },
      });
      await tx.orderItem.update({
        where: { id: item.order_item_id },
        data:  { status_id: subOrderItemStatusId },
      });
      await tx.pickingSession.update({
        where: { id: item.session_id },
        data:  { error_count: { increment: 1 } },
      });
      if (pickingStatusRow) {
        await tx.orderHistory.create({
          data: {
            order_id:   item.session.order_id,
            status_id:  pickingStatusRow.id,
            changed_by: null,
            note:       `Substitution par ${picker.name} : "${originalName}"${substituteName ? ` → "${substituteName}"` : ''}${reason ? ' (' + reason + ')' : ''}`,
          },
        });
      }
    });

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
