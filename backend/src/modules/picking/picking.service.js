const prisma = require('../../config/database');
const repo   = require('./picking.repository');

class PickingService {

  // ── List ────────────────────────────────────────────────────────────────────
  async listSessions(params) {
    const page  = Math.max(1, parseInt(params.page || 1));
    const limit = Math.min(100, parseInt(params.limit || 25));
    const { data, total } = await repo.findAllSessions({ ...params, page, limit });
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getSession(id) {
    const s = await repo.findSessionById(id);
    if (!s) throw { statusCode: 404, message: 'Session picking introuvable' };
    return s;
  }

  // ── Create session from order (auto-called when order → picking) ───────────
  async createSession(order_id) {
    // Load order with items
    const order = await prisma.order.findUnique({
      where: { id: order_id },
      include: {
        status: { select: { code: true } },
        items:  { include: { sku: { select: { id: true } } } },
      },
    });
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };

    // Avoid duplicate active sessions
    const existing = await repo.findSessionByOrder(order_id);
    if (existing && ['open', 'in_progress'].includes(existing.status.code)) return existing;

    const [openStatus, pendingItemStatus, picker] = await Promise.all([
      repo.getPickingStatusByCode('open'),
      repo.getPickItemStatusByCode('pending'),
      repo.getFirstPickerForNode(order.node_id),
    ]);

    if (!openStatus)        throw { statusCode: 500, message: 'Statut "open" introuvable — seed picking_statuses' };
    if (!pendingItemStatus) throw { statusCode: 500, message: 'Statut "pending" introuvable — seed pick_item_statuses' };

    // Create session
    const session = await prisma.pickingSession.create({
      data: {
        order_id,
        node_id:   order.node_id,
        picker_id: picker?.id ?? null,
        status_id: openStatus.id,
        items: {
          create: order.items.map(item => ({
            order_item_id: item.id,
            status_id:     pendingItemStatus.id,
            qty_expected:  item.qty,
            qty_picked:    0,
          })),
        },
      },
      include: repo.findSessionById.__proto__,
    });

    // Re-fetch with full include
    return repo.findSessionById(session.id);
  }

  // ── Start session ──────────────────────────────────────────────────────────
  async startSession(id, { picker_id, changed_by } = {}) {
    const session = await repo.findSessionById(id);
    if (!session) throw { statusCode: 404, message: 'Session introuvable' };
    if (session.status.code !== 'open') throw { statusCode: 422, message: `Session déjà ${session.status.name_fr}` };

    const inProgressStatus = await repo.getPickingStatusByCode('in_progress');
    if (!inProgressStatus) throw { statusCode: 500, message: 'Statut "in_progress" introuvable' };

    const pickingOrderStatus = await repo.getOrderStatusByCode('picking');
    await prisma.$transaction(async (tx) => {
      await tx.pickingSession.update({
        where: { id },
        data: {
          status_id:  inProgressStatus.id,
          started_at: new Date(),
          ...(picker_id && { picker_id }),
        },
      });
      if (pickingOrderStatus) {
        await tx.orderHistory.create({
          data: {
            order_id:  session.order_id,
            status_id: pickingOrderStatus.id,
            changed_by,
            note:       'Session picking démarrée',
          },
        });
      }
    });

    return repo.findSessionById(id);
  }

  // ── Complete session ───────────────────────────────────────────────────────
  async completeSession(id, changed_by = null) {
    const session = await repo.findSessionById(id);
    if (!session) throw { statusCode: 404, message: 'Session introuvable' };
    if (session.status.code === 'completed')
      throw { statusCode: 422, message: 'Session déjà terminée' };
    if (session.status.code !== 'in_progress')
      throw { statusCode: 422, message: `Session "${session.status.name_fr}" — démarrez la session avant de terminer` };

    // Bloque sur les items non traités ET sur les substitutions en attente
    // de réponse client (status 'substituted' == proposé mais pas encore résolu).
    const unresolved = session.items?.filter(i => ['pending', 'substituted'].includes(i.status.code)) ?? [];
    if (unresolved.length > 0) {
      const pendingCount     = unresolved.filter(i => i.status.code === 'pending').length;
      const substitutedCount = unresolved.filter(i => i.status.code === 'substituted').length;
      const parts = [];
      if (pendingCount > 0)     parts.push(`${pendingCount} article(s) encore en attente`);
      if (substitutedCount > 0) parts.push(`${substitutedCount} substitution(s) en attente de réponse client`);
      throw { statusCode: 422, message: `${parts.join(' et ')} — impossible de terminer la préparation` };
    }

    const [completedStatus, readyOrderStatus] = await Promise.all([
      repo.getPickingStatusByCode('completed'),
      repo.getOrderStatusByCode('ready'), 
    ]);
    if (!completedStatus) throw { statusCode: 500, message: 'Statut session "completed" introuvable' };

    await prisma.$transaction(async (tx) => {
      await tx.pickingSession.update({
        where: { id },
        data:  { status_id: completedStatus.id, completed_at: new Date() },
      });

      if (readyOrderStatus) {
        await tx.order.update({
          where: { id: session.order_id },
          data:  { status_id: readyOrderStatus.id },
        });
        await tx.orderHistory.create({
          data: {
            order_id:  session.order_id,
            status_id: readyOrderStatus.id,
            changed_by,
            note:      'Picking terminé — commande prête',
          },
        });
      }
    });

    return repo.findSessionById(id);
  }

  // ── Cancel session ─────────────────────────────────────────────────────────
  async cancelSession(id) {
    const session = await repo.findSessionById(id);
    if (!session) throw { statusCode: 404, message: 'Session introuvable' };
    const cancelledStatus = await repo.getPickingStatusByCode('cancelled');
    return repo.updateSession(id, { status_id: cancelledStatus.id });
  }

  // ── Pick item ─────────────────────────────────────────────────────────────
  async pickItem(item_id, { qty_picked, scanned_ean } = {}) {
    const item = await repo.findItemById(item_id);
    if (!item) throw { statusCode: 404, message: 'Article picking introuvable' };
    if (item.session.status.code !== 'in_progress')
      throw { statusCode: 422, message: 'Démarrez la session picking avant de traiter les articles' };

    // EAN validation if provided
    if (scanned_ean) {
      const expectedEan = item.order_item?.sku?.article?.ean13;
      if (expectedEan && scanned_ean !== expectedEan) {
        await repo.updateSession(item.session.id, { error_count: { increment: 1 } });
        throw { statusCode: 422, message: `EAN incorrect — attendu: ${expectedEan} | scanné: ${scanned_ean}` };
      }
    }

    const pickedStatus = await repo.getPickItemStatusByCode('picked');
    const qty = qty_picked ?? Number(item.qty_expected);

    return repo.updateItem(item_id, {
      status_id:   pickedStatus.id,
      qty_picked:  qty,
      scanned_ean: scanned_ean ?? item.scanned_ean,
      picked_at:   new Date(),
    });
  }

  // ── Substitute item ───────────────────────────────────────────────────────
  async substituteItem(item_id, { reason } = {}) {
    const item = await repo.findItemById(item_id);
    if (!item) throw { statusCode: 404, message: 'Article picking introuvable' };
    if (item.session.status.code !== 'in_progress')
      throw { statusCode: 422, message: 'Démarrez la session picking avant de traiter les articles' };

    const [status, oisSub, awaitingStockStatus] = await Promise.all([
      repo.getPickItemStatusByCode('substituted'),
      repo.getOrderItemStatusByCode('substituted'),
      repo.getOrderStatusByCode('awaiting_stock'),
    ]);

    await prisma.$transaction(async (tx) => {
      await tx.pickingSessionItem.update({
        where: { id: item_id },
        data:  { status_id: status.id, picked_at: new Date() },
      });

      if (oisSub) {
        await tx.orderItem.update({ where: { id: item.order_item_id }, data: { status_id: oisSub.id } });
      }

      // La commande passe en attente de réponse client tant que la
      // substitution proposée n'a pas été acceptée/refusée.
      if (awaitingStockStatus) {
        await tx.order.update({
          where: { id: item.session.order_id },
          data:  { status_id: awaitingStockStatus.id },
        });
        await tx.orderHistory.create({
          data: {
            order_id:  item.session.order_id,
            status_id: awaitingStockStatus.id,
            note:      `Substitution proposée${reason ? ' : ' + reason : ''} — en attente de réponse client`,
          },
        });
      }
    });

    return repo.findItemById(item_id);
  }

  // ── Out of stock ──────────────────────────────────────────────────────────
  async outOfStock(item_id) {
    const item = await repo.findItemById(item_id);
    if (!item) throw { statusCode: 404, message: 'Article picking introuvable' };
    if (item.session.status.code !== 'in_progress')
      throw { statusCode: 422, message: 'Démarrez la session picking avant de traiter les articles' };
    const status = await repo.getPickItemStatusByCode('missing'); 

    // Also update order_item status
    const oisOos = await repo.getOrderItemStatusByCode('out_of_stock');
    if (oisOos) {
      await prisma.orderItem.update({ where: { id: item.order_item_id }, data: { status_id: oisOos.id } });
    }

    return repo.updateItem(item_id, { status_id: status.id, qty_picked: 0 });
  }

  // ── Pickers list ──────────────────────────────────────────────────────────
  async listPickers(node_id) {
    return repo.getAllPickers(node_id);
  }

  // ── Assign picker ─────────────────────────────────────────────────────────
  async assignPicker(session_id, picker_id) {
    const session = await repo.findSessionById(session_id);
    if (!session) throw { statusCode: 404, message: 'Session introuvable' };
    return repo.updateSession(session_id, { picker_id });
  }
}

module.exports = new PickingService();