const repo          = require('./order_mgmt.repository');
const pickingService = require('../picking/picking.service');
const prisma         = require('../../config/database');

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
    return this.changeStatus(id, 'cancelled', changed_by);
  }

  async getHistory(id) {
    const order = await repo.findById(id);
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
    return repo.getHistory(id);
  }

  // ── Assign picker → creates session + transitions confirmed → picking ────────
  async assignPicker(order_id, picker_id, changed_by = null) {
    // 1. Load order
    const order = await prisma.order.findUnique({
      where: { id: order_id },
      include: { status: true, delivery_type: true, items: { include: { sku: { select: { id: true } } } } },
    });
    if (!order)                       throw { statusCode: 404, message: 'Commande introuvable' };
    if (order.status.code !== 'confirmed')
      throw { statusCode: 422, message: `Statut "${order.status.name_fr}" — affectation impossible (statut requis : confirmed)` };

    // 2. Load picker & validate
    const picker = await prisma.picker.findFirst({ where: { id: picker_id, is_active: true, is_deleted: false } });
    if (!picker) throw { statusCode: 404, message: 'Picker introuvable ou inactif' };
    if (picker.node_id !== order.node_id)
      throw { statusCode: 422, message: `Ce picker (${picker.name}) appartient au node ${picker.node_id}, pas au node de la commande` };

    // 3. Check no active session already
    const existing = await prisma.pickingSession.findFirst({
      where: { order_id, status: { code: { notIn: ['cancelled'] } } },
    });
    if (existing) throw { statusCode: 409, message: 'Une session picking est déjà en cours pour cette commande' };

    // 4. Get needed statuses
    const [openStatus, pendingItemStatus, pickingOrderStatus] = await Promise.all([
      prisma.pickingStatus.findFirst({ where: { code: 'open' } }),
      prisma.pickItemStatus.findFirst({ where: { code: 'pending' } }),
      prisma.orderStatus.findFirst({ where: { code: 'picking' } }),
    ]);
    if (!openStatus)         throw { statusCode: 500, message: 'Statut session "open" introuvable — seed picking_statuses' };
    if (!pendingItemStatus)  throw { statusCode: 500, message: 'Statut item "pending" introuvable — seed pick_item_statuses' };
    if (!pickingOrderStatus) throw { statusCode: 500, message: 'Statut commande "picking" introuvable' };

    // 5. Get primary location per SKU at this node
    const skuIds = order.items.filter(i => i.sku_id).map(i => i.sku_id);
    const skuLocations = skuIds.length ? await prisma.skuNodeLocation.findMany({
      where: { sku_id: { in: skuIds }, node_id: order.node_id, is_primary_location: true, is_active: true },
      select: { sku_id: true, location_id: true },
    }) : [];
    const locationMap = Object.fromEntries(skuLocations.map(l => [l.sku_id, l.location_id]));

    // 6. Transaction: create session + items + update order status + history
    const session = await prisma.$transaction(async (tx) => {
      const newSession = await tx.pickingSession.create({
        data: {
          order_id,
          node_id:   order.node_id,
          picker_id,
          status_id: openStatus.id,
          items: {
            create: order.items.map(item => ({
              order_item_id: item.id,
              status_id:     pendingItemStatus.id,
              qty_expected:  item.qty,
              qty_picked:    0,
              location_id:   item.sku_id ? (locationMap[item.sku_id] ?? null) : null,
            })),
          },
        },
      });

      await tx.order.update({ where: { id: order_id }, data: { status_id: pickingOrderStatus.id } });

      await tx.orderHistory.create({
        data: { order_id, status_id: pickingOrderStatus.id, changed_by, note: `Commande affectée au picker ${picker.name}` },
      });

      return newSession;
    });

    return prisma.pickingSession.findUnique({
      where: { id: session.id },
      include: {
        order:  { select: { id: true, total_ttc: true } },
        picker: { select: { id: true, name: true, phone_number: true } },
        status: { select: { code: true, name_fr: true } },
        items:  { include: { status: { select: { code: true, name_fr: true } }, location: { select: { code: true, aisle: true, shelf: true } } } },
      },
    });
  }

  // ── Confirm pickup → delivers order + collects COD + releases stock ──────────
  async confirmPickup(order_id, { note } = {}, changed_by = null) {
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
    if (order.delivery_type?.code !== 'pickup')
      throw { statusCode: 422, message: 'Cette commande n\'est pas de type retrait magasin (pickup)' };
    if (order.status.code !== 'ready')
      throw { statusCode: 422, message: `Statut "${order.status.name_fr}" — retrait impossible (statut requis : ready)` };

    const [deliveredStatus, collectedPayStatus, vendeMoveType] = await Promise.all([
      prisma.orderStatus.findFirst({ where: { code: 'delivered' } }),
      prisma.paymentStatus.findFirst({ where: { code: 'collected' } }),
      prisma.moveType.findFirst({ where: { code: 'VENTE' } }),
    ]);
    if (!deliveredStatus) throw { statusCode: 500, message: 'Statut "delivered" introuvable' };

    await prisma.$transaction(async (tx) => {
      // 1. Order → delivered
      await tx.order.update({ where: { id: order_id }, data: { status_id: deliveredStatus.id } });

      // 2. Collect payment
      const payment = order.payments.find(p => p.status?.code !== 'collected');
      if (payment && collectedPayStatus) {
        const isCOD = payment.payment_method?.code === 'cod';
        await tx.payment.update({ where: { id: payment.id }, data: { status_id: collectedPayStatus.id } });
        if (isCOD) await tx.order.update({ where: { id: order_id }, data: { cod_collected_at: new Date() } });
      }

      // 3. Release reservation + decrement physical stock + stock_move
      for (const item of order.items) {
        if (!item.sku_id) continue;
        const qty = Number(item.qty);
        // At order creation: qty_reserved++, qty_available--
        // At delivery: qty_reserved--, qty_physical-- (available stays same — already decremented)
        await tx.stockLevel.updateMany({
          where: { node_id: order.node_id, sku_id: item.sku_id },
          data:  { qty_reserved: { decrement: qty }, qty_physical: { decrement: qty } },
        });
        if (vendeMoveType) {
          await tx.stockMove.create({
            data: { node_id: order.node_id, sku_id: item.sku_id, move_type_id: vendeMoveType.id, order_id, qty_delta: -qty, reason: 'Retrait magasin — clôture commande' },
          });
        }
      }

      // 4. History
      await tx.orderHistory.create({
        data: { order_id, status_id: deliveredStatus.id, changed_by, note: note || 'Commande retirée au magasin' },
      });
    });

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
