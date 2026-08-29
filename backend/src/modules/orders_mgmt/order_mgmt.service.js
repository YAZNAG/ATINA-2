const repo          = require('./order_mgmt.repository');
const pickingService = require('../picking/picking.service');
const prisma         = require('../../config/database');
const { createPickingSessionForOrder } = require('../../utils/createPickingSession.helper');
const loyalty = require('../loyalty/loyalty.service');
const { notifyOrderReady, notifyInDelivery, notifyDelivered, notifyCancelled } = require('../../utils/notify');

// ── Status transition rules ───────────────────────────────────────────────────
const TRANSITIONS = {
  PENDING:             ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:           ['PICKING', 'CANCELLED'],
  PICKING:             ['READY', 'CANCELLED'],
  READY:               ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY:    ['DELIVERED', 'PARTIALLY_DELIVERED', 'RETURNED', 'CANCELLED'],
  PARTIALLY_DELIVERED: ['DELIVERED', 'RETURNED'],
};

const STATUS_LABELS = {
  CONFIRMED:           'Confirmer',
  PICKING:             'Lancer picking',
  READY:               'Marquer prête',
  OUT_FOR_DELIVERY:    'Lancer livraison',
  DELIVERED:           'Marquer livrée',
  PARTIALLY_DELIVERED: 'Marquer partiellement livrée',
  CANCELLED:           'Annuler',
  RETURNED:            'Retourner',
};

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

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
    const allowed = TRANSITIONS[normalizeCode(order.status.code)] ?? [];
    return allowed.map(code => ({ code, label: STATUS_LABELS[code] ?? code }));
  }

  async changeStatus(id, new_status_code, changed_by = null) {
    const order = await repo.findById(id);
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
    if (order.status.is_terminal)
      throw { statusCode: 422, message: `Statut "${order.status.name_fr}" est terminal — aucune transition possible` };

    const currentCode = normalizeCode(order.status.code);
    const nextCode = normalizeCode(new_status_code);
    const deliveryCode = normalizeCode(order.delivery_type?.code);
    let allowed = TRANSITIONS[currentCode] ?? [];

    if (deliveryCode === 'PICKUP') {
      allowed = allowed.filter(code => code !== 'OUT_FOR_DELIVERY');
    } else if (currentCode === 'READY') {
      allowed = allowed.filter(code => code !== 'DELIVERED');
    }

    if (!allowed.includes(nextCode))
      throw {
        statusCode: 422,
        message: `Transition "${currentCode}" → "${nextCode}" non autorisée pour ce type de livraison. Transitions valides: ${allowed.join(', ') || 'aucune'}`,
      };

    const newStatus = await repo.getStatusByCode(nextCode);
    if (!newStatus) throw { statusCode: 404, message: `Statut "${nextCode}" introuvable en base` };

    const updated = await prisma.$transaction(async (tx) => {
      const upd = await tx.order.update({
        where: { id },
        data: { status_id: newStatus.id },
        include: repo.DETAIL_INCLUDE,
      });
      await tx.orderHistory.create({
        data: { order_id: id, status_id: newStatus.id, changed_by, note: null },
      });

      if (nextCode === 'DELIVERED') {
        await loyalty.creditPointsOnDelivery(tx, order.customer_id, order, newStatus.id);
      }

      return upd;
    });

    if (nextCode === 'DELIVERED') {
      setImmediate(() => loyalty.validateReferralOnDelivery(order.customer_id, id).catch(() => {}));
    }

    const NOTIFY = {
      READY:            () => notifyOrderReady(order.customer_id, id, order.delivery_type?.code),
      OUT_FOR_DELIVERY: () => notifyInDelivery(order.customer_id, id),
      DELIVERED:        () => notifyDelivered(order.customer_id, id),
    };
    NOTIFY[nextCode]?.()?.catch(() => {});

    if (nextCode === 'PICKING') {
      pickingService.createSession(id).catch(err =>
        console.warn('[picking] Création session auto échouée:', err.message)
      );
    }

    return updated;
  }

  async cancel(id, reason, changed_by = null) {
    const order = await repo.findById(id);
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };

    const result = await this.changeStatus(id, 'CANCELLED', changed_by);

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
        ['COLLECTED', 'PAID', 'CAPTURED'].includes(normalizeCode(p.status?.code))
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

    notifyCancelled(order.customer_id, id, reason).catch(() => {});

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
    if (normalizeCode(order.status.code) === 'DELIVERED')
      throw { statusCode: 422, message: 'Commande déjà clôturée (retrait confirmé)' };
    if (normalizeCode(order.delivery_type?.code) !== 'PICKUP')
      throw { statusCode: 422, message: 'Cette commande n\'est pas de type retrait magasin (pickup)' };
    if (normalizeCode(order.status.code) !== 'READY')
      throw { statusCode: 422, message: `Statut "${order.status.name_fr}" — retrait impossible (statut requis : READY)` };
    if (payment_collected !== true)
      throw { statusCode: 422, message: 'Confirmation requise : indiquez payment_collected: true après encaissement' };

    const payments = [...(order.payments ?? [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const primaryPayment = payments[0];
    if (!primaryPayment)
      throw { statusCode: 422, message: 'Aucun paiement enregistré pour cette commande' };

    const isCOD = ['COD', 'CASH'].includes(normalizeCode(primaryPayment.payment_method?.code));
    const payCode = normalizeCode(primaryPayment.status?.code);
    if (!['PENDING', 'COLLECTED'].includes(payCode))
      throw { statusCode: 422, message: `Statut paiement incompatible (${payCode}) — impossible de confirmer le retrait` };

    for (const item of order.items) {
      if (!item.sku_id) continue;
      const qty = Number(item.qty);
      const level = await prisma.stockLevel.findUnique({
        where: { node_id_sku_id: { node_id: order.node_id, sku_id: item.sku_id } },
      });
      if (!level) throw { statusCode: 422, message: `Stock introuvable pour un article de la commande (SKU)` };
      if (Number(level.qty_reserved) < qty || Number(level.qty_physical) < qty) {
        throw { statusCode: 422, message: 'Stock insuffisant (physique ou réservé) pour finaliser le retrait' };
      }
    }

    const [deliveredStatus, collectedPayStatus, saleMoveType] = await Promise.all([
      prisma.orderStatus.findFirst({ where: { code: 'DELIVERED' } }),
      prisma.paymentStatus.findFirst({ where: { code: 'COLLECTED' } }),
      prisma.moveType.findFirst({ where: { code: 'sale' } }).then((m) => m || prisma.moveType.findFirst({ where: { code: 'VENTE' } })),
    ]);
    if (!deliveredStatus) throw { statusCode: 500, message: 'Statut "DELIVERED" introuvable — lancez le seed' };
    if (!collectedPayStatus) throw { statusCode: 500, message: 'Statut paiement "COLLECTED" introuvable' };

    const historyNote = note?.trim() || 'Commande retirée au magasin';

    await prisma.$transaction(async (tx) => {
      if (payCode === 'PENDING') {
        await tx.payment.update({ where: { id: primaryPayment.id }, data: { status_id: collectedPayStatus.id } });
      }

      for (const item of order.items) {
        if (!item.sku_id) continue;
        const qty = Number(item.qty);

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
    notifyDelivered(order.customer_id, order_id).catch(() => {});
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

  // node_id/date optionnels : passés depuis le front pour restreindre le
  // dropdown de créneaux au node/jour de la commande en cours d'édition.
  async meta({ node_id, date } = {}) {
    const [
      statusCounts,
      nodes,
      deliveryTypes,
      slots,
    ] = await Promise.all([
      repo.countByStatus(),
      repo.getNodes(),
      repo.getDeliveryTypes(),
      repo.getSlots({ node_id, date }),
    ]);

    return {
      status_counts: statusCounts,
      nodes,
      delivery_types: deliveryTypes,
      slots,
    };
  }

  async updateSlot(order_id, slot_id, changed_by = null) {
    const order = await repo.findById(order_id);

    if (!order) {
      throw {
        statusCode: 404,
        message: 'Commande introuvable',
      };
    }

    if (order.status?.is_terminal) {
      throw {
        statusCode: 422,
        message: 'Impossible de modifier le créneau d’une commande clôturée',
      };
    }

    const slot = await prisma.deliverySlot.findFirst({
      where: {
        id: slot_id,
      },
      select: {
        id: true,
        node_id: true,
        specific_date: true,
        slot_start: true,
        slot_end: true,
      },
    });

    if (!slot) {
      throw {
        statusCode: 404,
        message: 'Créneau introuvable',
      };
    }

    const updatedOrder = await prisma.order.update({
      where: {
        id: order_id,
      },
      data: {
        confirmed_slot_id: slot_id,
      },
      include: repo.DETAIL_INCLUDE,
    });

    return updatedOrder;
  }
}

module.exports = new OrderMgmtService();