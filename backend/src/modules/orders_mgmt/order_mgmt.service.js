const repo          = require('./order_mgmt.repository');
const pickingService = require('../picking/picking.service');
const prisma         = require('../../config/database');
const { createPickingSessionForOrder } = require('../../utils/createPickingSession.helper');
const loyalty = require('../loyalty/loyalty.service');

// ── Status transition rules ───────────────────────────────────────────────────
const TRANSITIONS = {
  pending:        ['confirmed', 'cancelled'],
  awaiting_stock: ['confirmed', 'cancelled'],
  confirmed:      ['picking',   'cancelled'],
  picking:        ['ready',     'cancelled'],
  ready:          ['in_delivery','cancelled'],
  in_delivery:    ['delivered', 'cancelled', 'returned'],
};

const STATUS_LABELS = {
  confirmed:   'Confirmer',
  picking:     'Lancer picking',
  ready:       'Marquer prête',
  in_delivery: 'Lancer livraison',
  delivered:   'Marquer livrée',
  cancelled:   'Annuler',
  returned:    'Retourner',
};

class OrderMgmtService {
  async list(params) {
    const page  = Math.max(1, parseInt(params.page  || 1));
    const limit = Math.min(100, Math.max(1, parseInt(params.limit || 25)));
    const { data, total } = await repo.findAll({ ...params, page, limit });
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const order = await repo.findById(id);
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
    return order;
  }

  async getTransitions(id) {
    const order = await repo.findById(id);
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
    const allowed = TRANSITIONS[order.status.code] ?? [];
    return allowed.map(code => ({ code, label: STATUS_LABELS[code] ?? code }));
  }

  async changeStatus(id, new_status_code, changed_by = null) {
    const order = await repo.findById(id);
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
    if (order.status.is_terminal)
      throw { statusCode: 422, message: `Statut "${order.status.name_fr}" est terminal — aucune transition possible` };

    const allowed = TRANSITIONS[order.status.code] ?? [];
    if (!allowed.includes(new_status_code))
      throw { statusCode: 422, message: `Transition "${order.status.code}" → "${new_status_code}" non autorisée. Transitions valides: ${allowed.join(', ') || 'aucune'}` };

    const newStatus = await repo.getStatusByCode(new_status_code);
    if (!newStatus) throw { statusCode: 404, message: `Statut "${new_status_code}" introuvable en base` };

    const updated = await repo.updateStatus(id, newStatus.id, changed_by);

    // Auto-create picking session when order → picking
    if (new_status_code === 'picking') {
      pickingService.createSession(id).catch(err =>
        console.warn('[picking] Création session auto échouée:', err.message)
      );
    }

    return updated;
  }

  async cancel(id, reason, changed_by = null) {
    const order = await repo.findById(id);
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };

    const result = await this.changeStatus(id, 'cancelled', changed_by);

    // Release reserved stock: qty_reserved-- + qty_available++ (restore availability)
    // Formula: qty_available = qty_physical - qty_reserved → reserved-- → available++ ✓
    const [items, cancelMoveType] = await Promise.all([
      prisma.orderItem.findMany({ where: { order_id: id } }),
      prisma.moveType.findFirst({ where: { code: { in: ['reservation_cancel', 'RESERVATION_CANCEL'] } } }),
    ]);

    for (const item of items) {
      if (!item.sku_id) continue;
      const qty     = Number(item.qty);
      const reserved = Number(item.qty) - Number(item.qty_backordered ?? 0);
      const backordered = Number(item.qty_backordered ?? 0);

      // Release normal reservation
      if (reserved > 0) {
        await prisma.stockLevel.updateMany({
          where: { node_id: order.node_id, sku_id: item.sku_id, qty_reserved: { gte: reserved } },
          data:  { qty_reserved: { decrement: reserved }, qty_available: { increment: reserved } },
        });
      }
      // Release backorder
      if (backordered > 0) {
        await prisma.stockLevel.updateMany({
          where: { node_id: order.node_id, sku_id: item.sku_id },
          data:  { qty_backordered: { decrement: backordered } },
        });
      }

      // Trace the release via stock_move
      if (cancelMoveType && qty > 0) {
        await prisma.stockMove.create({
          data: {
            node_id:      order.node_id,
            sku_id:       item.sku_id,
            move_type_id: cancelMoveType.id,
            order_id:     id,
            qty_delta:    0,
            reason:       `Annulation réservation — commande ${id.slice(0, 8)}`,
          },
        });
      }
    }

    // Coupon : décrémenter uses_count seulement si le paiement n'est pas encore confirmé
    if (order.promotion_id) {
      const isPaid = (order.payments ?? []).some(p =>
        ['collected', 'paid', 'captured'].includes(p.status?.code)
      );
      if (!isPaid) {
        await Promise.all([
          prisma.promotion.update({
            where: { id: order.promotion_id },
            data:  { uses_count: { decrement: 1 } },
          }),
          prisma.couponRedemption.deleteMany({
            where: { promotion_id: order.promotion_id, order_id: id },
          }),
        ]);
      }
    }

    if (reason) {
      await prisma.order.update({ where: { id }, data: { cancelled_reason: reason } });
    }

    return result;
  }

  async getHistory(id) {
    const order = await repo.findById(id);
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
    return repo.getHistory(id);
  }

  // ── Assign picker → creates session + transitions confirmed → picking ────────
  async assignPicker(order_id, picker_id, changed_by = null) {
    // Charger le nom du picker pour la note d'historique
    const picker = await prisma.picker.findFirst({
      where: { id: picker_id, is_active: true, is_deleted: false },
      select: { name: true },
    });
    const actorLabel = picker ? `le picker ${picker.name} (affectation admin)` : 'admin';

    return createPickingSessionForOrder(order_id, picker_id, changed_by, actorLabel);
  }

  // ── Confirm pickup → delivers order + collects payment + releases stock ───────
  async confirmPickup(order_id, { payment_collected, note } = {}, changed_by = null) {
    const order = await prisma.order.findUnique({
      where: { id: order_id },
      include: {
        status:        true,
        delivery_type: true,
        items:         { include: { sku: { select: { id: true } } } },
        payments:      { include: { payment_method: { select: { code: true, name_fr: true } }, status: { select: { code: true } } } },
      },
    });
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
    if (order.status.code === 'delivered')
      throw { statusCode: 422, message: 'Commande déjà clôturée (livrée)' };
    if (order.delivery_type?.code !== 'pickup')
      throw { statusCode: 422, message: 'Cette commande n\'est pas de type retrait magasin (pickup)' };
    if (order.status.code !== 'ready')
      throw { statusCode: 422, message: `Statut "${order.status.name_fr}" — retrait impossible (statut requis : ready)` };
    if (payment_collected !== true)
      throw { statusCode: 422, message: 'Confirmation requise : indiquez payment_collected: true après encaissement' };

    const payments = [...(order.payments ?? [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const primaryPayment = payments[0];
    if (!primaryPayment)
      throw { statusCode: 422, message: 'Aucun paiement enregistré pour cette commande' };

    const isCOD = primaryPayment.payment_method?.code === 'cod';
    const payCode = primaryPayment.status?.code;
    if (!['pending', 'collected'].includes(payCode || ''))
      throw { statusCode: 422, message: `Statut paiement incompatible (${payCode}) — impossible de confirmer le retrait` };

    for (const item of order.items) {
      if (!item.sku_id) continue;
      const qty = Number(item.qty);
      const level = await prisma.stockLevel.findUnique({
        where: { node_id_sku_id: { node_id: order.node_id, sku_id: item.sku_id } },
      });
      if (!level) throw { statusCode: 422, message: `Stock introuvable pour un article de la commande (SKU)` };
      // qty_physical must be >= qty (real stock on shelves)
      // qty_reserved must be >= qty (was reserved at checkout)
      if (Number(level.qty_reserved) < qty || Number(level.qty_physical) < qty) {
        throw { statusCode: 422, message: 'Stock insuffisant (physique ou réservé) pour finaliser le retrait' };
      }
    }

    const [deliveredStatus, collectedPayStatus, saleMoveType] = await Promise.all([
      prisma.orderStatus.findFirst({ where: { code: 'delivered' } }),
      prisma.paymentStatus.findFirst({ where: { code: 'collected' } }),
      prisma.moveType.findFirst({ where: { code: 'sale' } }).then((m) => m || prisma.moveType.findFirst({ where: { code: 'VENTE' } })),
    ]);
    if (!deliveredStatus) throw { statusCode: 500, message: 'Statut "delivered" introuvable' };
    if (!collectedPayStatus) throw { statusCode: 500, message: 'Statut paiement "collected" introuvable' };

    const historyNote = note?.trim() || 'Commande retirée au magasin';

    await prisma.$transaction(async (tx) => {
      if (payCode === 'pending') {
        await tx.payment.update({ where: { id: primaryPayment.id }, data: { status_id: collectedPayStatus.id } });
      }

      for (const item of order.items) {
        if (!item.sku_id) continue;
        const qty = Number(item.qty);
        // Formula: qty_available = qty_physical - qty_reserved
        // At delivery: physical decrements + reservation released → qty_available unchanged
        // (physical - qty) - (reserved - qty) = physical - reserved = qty_available ✓
        const upd = await tx.stockLevel.updateMany({
          where: {
            node_id: order.node_id,
            sku_id: item.sku_id,
            qty_reserved: { gte: qty },
            qty_physical: { gte: qty },
          },
          data: { qty_reserved: { decrement: qty }, qty_physical: { decrement: qty } },
        });
        if (upd.count !== 1) {
          throw { statusCode: 422, message: 'Mise à jour stock impossible (quantités insuffisantes)' };
        }
        if (saleMoveType) {
          await tx.stockMove.create({
            data: {
              node_id: order.node_id,
              sku_id: item.sku_id,
              move_type_id: saleMoveType.id,
              order_id,
              qty_delta: -qty,
              reason: 'Retrait magasin — vente',
            },
          });
        }
      }

      await tx.order.update({
        where: { id: order_id },
        data: {
          status_id: deliveredStatus.id,
          ...(isCOD && !order.cod_collected_at ? { cod_collected_at: new Date() } : {}),
        },
      });

      // Credit points using rules engine
      await loyalty.creditPointsOnDelivery(tx, order.customer_id, { ...order, id: order_id }, deliveredStatus.id);

      await tx.orderHistory.create({
        data: { order_id, status_id: deliveredStatus.id, changed_by, note: historyNote },
      });
    });

    // Trigger referral validation (fire-and-forget — never blocks main flow)
    setImmediate(() => loyalty.validateReferralOnDelivery(order.customer_id, order_id).catch(() => {}));

    return repo.findById(order_id);
  }

  // ── Get pickers for a node (for assignment modal) ──────────────────────────
  async getPickersForNode(node_id) {
    return prisma.picker.findMany({
      where: { node_id, is_active: true, is_deleted: false },
      select: { id: true, name: true, phone_country: true, phone_number: true },
      orderBy: { name: 'asc' },
    });
  }

  async meta() {
    const [statusCounts, nodes, deliveryTypes] = await Promise.all([
      repo.countByStatus(),
      repo.getNodes(),
      repo.getDeliveryTypes(),
    ]);
    return { status_counts: statusCounts, nodes, delivery_types: deliveryTypes };
  }
}

module.exports = new OrderMgmtService();
