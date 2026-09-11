const repo           = require('./order_mgmt.repository');
const pickingService = require('../picking/picking.service');
const prisma         = require('../../config/database');
const { audit }      = require('../../utils/audit');
const { createPickingSessionForOrder } = require('../../utils/createPickingSession.helper');
const loyalty = require('../loyalty/loyalty.service');
const { notifyOrderReady, notifyInDelivery, notifyDelivered } = require('../../utils/notify');
const L = require('./order_lifecycle');

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
    const users = await repo.getUsersByIds([order.slot_assigned_by]);
    return {
      ...order,
      slot_assigned_by_user: order.slot_assigned_by ? users[order.slot_assigned_by] ?? null : null,
      can_cancel: L.CANCELLABLE.includes(L.normStatus(order.status?.code)),
      can_change_slot: !L.CLOSED.includes(L.normStatus(order.status?.code)),
    };
  }

  async getTransitions(id) {
    const order = await repo.findById(id);
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
    return L.allowedTransitions(order).map((code) => ({ code, label: L.TRANSITION_LABELS[code] ?? code }));
  }

  // ── Évolution du statut (US-057) ───────────────────────────────────────────
  async changeStatus(id, new_status_code, req = null) {
    const order = await repo.findById(id);
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };

    const current = L.normStatus(order.status?.code);
    const next = L.normStatus(new_status_code);
    if (next === 'cancelled') {
      throw { statusCode: 400, message: "Utilisez l'action « Annuler la commande » (motif obligatoire)." };
    }
    if (order.status?.is_terminal || L.CLOSED.includes(current)) {
      throw { statusCode: 422, message: `Statut « ${order.status?.name_fr} » terminal : aucune transition possible.` };
    }
    const allowed = L.allowedTransitions(order);
    if (!allowed.includes(next)) {
      const labels = allowed.map((c) => L.TRANSITION_LABELS[c] || c).join(', ') || 'aucune';
      throw { statusCode: 422, message: `Transition « ${order.status?.name_fr} » → « ${next} » non autorisée. Transitions possibles : ${labels}.` };
    }

    const newStatus = await repo.getStatusByCode(next);
    if (!newStatus) throw { statusCode: 500, message: `Statut « ${next} » introuvable en base` };
    const changed_by = req?.user?.id ?? null;

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: { status_id: newStatus.id } });
      await tx.orderHistory.create({ data: { order_id: id, status_id: newStatus.id, changed_by, note: null } });

      if (next === 'delivered') {
        await L.applyDeliveryStock(tx, id, req, 'Livraison — vente (back-office)');
        await loyalty.creditPointsOnDelivery(tx, order.customer_id, order, newStatus.id);
      }

      await audit(req, {
        action: 'UPDATE_STATUS',
        resource: 'orders',
        resource_id: id,
        old_values: { status: current },
        new_values: { status: next },
      }, tx);
    }, { timeout: 30000 });

    if (next === 'delivered') {
      setImmediate(() => loyalty.validateReferralOnDelivery(order.customer_id, id).catch(() => {}));
    }
    const NOTIFY = {
      ready:       () => notifyOrderReady(order.customer_id, id, order.delivery_type?.code),
      in_delivery: () => notifyInDelivery(order.customer_id, id),
      delivered:   () => notifyDelivered(order.customer_id, id),
    };
    try { NOTIFY[next]?.()?.catch(() => {}); } catch { /* notification optionnelle */ }

    if (next === 'picking') {
      pickingService.createSession(id).catch((err) =>
        console.warn('[picking] Création session auto échouée:', err.message)
      );
    }

    return this.getById(id);
  }

  // ── Annulation (WF #29) ───────────────────────────────────────────────────
  async cancelPreview(id) {
    return L.previewCancel(id);
  }

  async cancel(id, reason, req = null) {
    await L.cancelOrder(id, reason, req);
    return this.getById(id);
  }

  // ── Suivi des statuts : qui / quoi / quand ───────────────────────────────
  async getHistory(id) {
    const order = await prisma.order.findFirst({ where: { id, is_deleted: false }, select: { id: true } });
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };

    const [histories, logs] = await Promise.all([
      repo.getHistory(id),
      prisma.auditLog.findMany({
        where: {
          OR: [
            { resource: 'orders', resource_id: id },
            { resource: 'payments', new_values: { path: ['order_id'], equals: id } },
          ],
        },
        orderBy: { created_at: 'asc' },
      }),
    ]);
    const users = await repo.getUsersByIds([
      ...histories.map((h) => h.changed_by),
      ...logs.map((l) => l.user_id),
    ]);
    const who = (uid) => (uid ? users[uid]?.full_name || `Utilisateur #${uid}` : 'Système');

    const ACTIONS = {
      CREATE: 'Création de la commande',
      UPDATE_STATUS: 'Changement de statut',
      ASSIGN_SLOT: 'Créneau confirmé / modifié',
      CANCEL_ORDER: 'Annulation',
      UPDATE: 'Commande modifiée',
      UPDATE_ORDER_LINE: 'Ligne de commande ajustée',
      REDEEM_COUPON: 'Code promo appliqué',
      DELIVER_ORDER: 'Sortie de stock (livraison)',
      COLLECT_PAYMENT: 'Encaissement enregistré',
    };

    const events = [
      ...histories.map((h) => ({
        id: h.id,
        type: 'status',
        at: h.created_at,
        status: h.status,
        label: h.status?.name_fr || h.status?.code,
        by: who(h.changed_by),
        by_id: h.changed_by,
        note: h.note,
      })),
      ...logs
        .filter((l) => l.action !== 'UPDATE_STATUS' && !(l.action === 'CANCEL_ORDER' && l.resource === 'orders'))
        .filter((l) => l.resource === 'orders' || l.resource === 'payments')
        .map((l) => ({
          id: l.id,
          type: 'audit',
          at: l.created_at,
          action: l.action,
          label: ACTIONS[l.action] || l.action,
          by: who(l.user_id),
          by_id: l.user_id,
          note: null,
          old_values: l.old_values,
          new_values: l.new_values,
        })),
    ];
    events.sort((a, b) => new Date(a.at) - new Date(b.at));
    return events;
  }

  // ── Créneaux (WF #3 / #20 — US-037 / US-038 / US-107) ─────────────────────
  async getSlots(id, { from, days = 21 } = {}) {
    const order = await repo.findById(id);
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };

    const today = new Date();
    const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + Math.min(90, Math.max(1, Number(days) || 21)));

    const slots = await prisma.deliverySlot.findMany({
      where: {
        node_id: order.node_id,
        is_active: true,
        specific_date: { gte: start, lt: end },
      },
      orderBy: [{ specific_date: 'asc' }, { slot_start: 'asc' }],
    });
    // Le créneau confirmé reste visible même s'il est passé ou désactivé.
    if (order.confirmed_slot_id && !slots.some((s) => s.id === order.confirmed_slot_id)) {
      const current = await prisma.deliverySlot.findUnique({ where: { id: order.confirmed_slot_id } });
      if (current) slots.unshift(current);
    }
    const enriched = await L.enrichSlotsCapacity(slots, { excludeOrderId: order.id });
    const prefBySlot = Object.fromEntries((order.slot_preferences || []).map((p) => [p.slot_id, p]));
    const users = await repo.getUsersByIds([order.slot_assigned_by]);

    return {
      order_id: order.id,
      node: order.node,
      slot_selection_enabled: order.node?.slot_selection_enabled !== false,
      can_change: !L.CLOSED.includes(L.normStatus(order.status?.code)),
      confirmed_slot: order.confirmed_slot,
      slot_start: order.slot_start,
      slot_end: order.slot_end,
      assignment_source: order.assignment_source,
      assigned_by: order.slot_assigned_by ? users[order.slot_assigned_by] ?? { id: order.slot_assigned_by } : null,
      preferences: (order.slot_preferences || []).map((p) => ({
        id: p.id,
        preference_order: p.preference_order,
        status: p.status,
        slot: p.slot,
        created_at: p.created_at,
      })),
      slots: enriched.map((s) => ({
        ...s,
        is_confirmed: s.id === order.confirmed_slot_id,
        preference: prefBySlot[s.id] ? { order: prefBySlot[s.id].preference_order, status: prefBySlot[s.id].status?.code } : null,
      })),
    };
  }

  async updateSlot(order_id, slot_id, req = null) {
    if (!slot_id) throw { statusCode: 400, message: 'slot_id requis' };
    const order = await repo.findById(order_id);
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
    const code = L.normStatus(order.status?.code);
    if (L.CLOSED.includes(code)) {
      throw { statusCode: 422, message: `Commande « ${order.status?.name_fr} » : le créneau n'est plus modifiable.` };
    }

    const slot = await prisma.deliverySlot.findUnique({ where: { id: slot_id } });
    if (!slot) throw { statusCode: 404, message: 'Créneau introuvable' };
    if (slot.node_id !== order.node_id) throw { statusCode: 422, message: "Ce créneau n'appartient pas au nœud de la commande." };
    if (!slot.is_active) throw { statusCode: 422, message: 'Ce créneau est désactivé.' };

    // Capacité affichée mais non bloquante (US-037).
    const res = await L.slotReservations([slot.id], { excludeOrderId: order.id });
    const reservations = res[slot.id] || 0;
    const isFull = slot.max_orders != null && reservations >= slot.max_orders;

    const [backoffice, confirmed, rejected] = await Promise.all([
      L.mustCode('slotAssignmentSource', 'backoffice', "source d'affectation"),
      L.byCode('orderSlotStatus', 'confirmed'),
      L.byCode('orderSlotStatus', 'rejected'),
    ]);

    const dateStr = L.dateKey(slot.specific_date);
    const tz = order.node?.timezone || 'Africa/Casablanca';
    const slot_start = L.zonedDateTime(dateStr, slot.slot_start, tz);
    const slot_end = L.zonedDateTime(dateStr, slot.slot_end, tz);
    const userId = req?.user?.id ?? null;

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order_id },
        data: {
          confirmed_slot_id: slot.id,
          slot_start,
          slot_end,
          assignment_source_id: backoffice.id,
          slot_assigned_by: userId,
        },
      });
      const prefs = order.slot_preferences || [];
      if (prefs.length && confirmed && rejected) {
        const chosen = prefs.filter((p) => p.slot_id === slot.id).map((p) => p.id);
        const others = prefs.filter((p) => p.slot_id !== slot.id).map((p) => p.id);
        if (chosen.length) await tx.orderSlotPreference.updateMany({ where: { id: { in: chosen } }, data: { status_id: confirmed.id } });
        if (others.length) await tx.orderSlotPreference.updateMany({ where: { id: { in: others } }, data: { status_id: rejected.id } });
      }
      await audit(req, {
        action: 'ASSIGN_SLOT',
        resource: 'orders',
        resource_id: order_id,
        old_values: {
          confirmed_slot_id: order.confirmed_slot_id,
          slot: order.confirmed_slot ? L.slotLabel(order.confirmed_slot) : null,
          assignment_source: order.assignment_source?.code ?? null,
        },
        new_values: {
          confirmed_slot_id: slot.id,
          slot: L.slotLabel(slot),
          assignment_source: 'backoffice',
          assigned_by: userId,
          capacity: { max_orders: slot.max_orders, reservations_before: reservations, full: isFull },
        },
      }, tx);
    });

    const updated = await this.getById(order_id);
    return {
      ...updated,
      capacity_warning: isFull
        ? `Créneau complet (${reservations}/${slot.max_orders}) : affectation enregistrée malgré tout.`
        : null,
    };
  }

  // ── Modification de la commande (WF #28) : adresse de livraison, notes ────
  async updateOrder(id, { address_id, notes } = {}, req = null) {
    const order = await repo.findById(id);
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
    const code = L.normStatus(order.status?.code);
    if (L.CLOSED.includes(code)) throw { statusCode: 422, message: `Commande « ${order.status?.name_fr} » : plus modifiable.` };

    const data = {};
    if (address_id !== undefined && address_id !== order.address_id) {
      if (['in_delivery'].includes(code)) throw { statusCode: 422, message: "Commande en livraison : l'adresse ne peut plus être modifiée." };
      if (!address_id) throw { statusCode: 400, message: 'Adresse requise' };
      const addr = await prisma.address.findFirst({ where: { id: address_id, customer_id: order.customer_id, is_deleted: false } });
      if (!addr) throw { statusCode: 422, message: "Cette adresse n'appartient pas au client de la commande." };
      data.address_id = address_id;
    }
    if (notes !== undefined) data.notes = String(notes ?? '').trim() || null;
    if (!Object.keys(data).length) return this.getById(id);

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data });
      await audit(req, {
        action: 'UPDATE', resource: 'orders', resource_id: id,
        old_values: { address_id: order.address_id, notes: order.notes },
        new_values: data,
      }, tx);
    });
    return this.getById(id);
  }

  /**
   * Ajustement d'une ligne (US-059, WF #28) : réduction de quantité ou annulation
   * de la ligne (qty = 0) tant que la commande n'est pas prête. Libère la
   * réservation (rupture d'abord), rend le quota flash, recalcule les montants
   * et le paiement à encaisser. Les lignes composant un pack ne s'ajustent pas
   * individuellement (annuler la commande ou la recréer).
   */
  async updateItem(order_id, item_id, { qty, reason } = {}, req = null) {
    const newQty = Number(qty);
    if (!Number.isFinite(newQty) || newQty < 0) throw { statusCode: 400, message: 'Quantité invalide (≥ 0)' };
    const motif = String(reason ?? '').trim();

    const [cancelledItemStatus] = await Promise.all([L.byCode('orderItemStatus', 'cancelled')]);

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: order_id, is_deleted: false },
        include: {
          status: true,
          items: { include: { status: { select: { code: true } } } },
          payments: { include: { status: true } },
        },
      });
      if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
      const code = L.normStatus(order.status?.code);
      if (!['pending', 'awaiting_stock', 'confirmed', 'picking'].includes(code)) {
        throw { statusCode: 422, message: `Commande « ${order.status?.name_fr} » : les lignes ne sont modifiables qu'avant la fin de la préparation.` };
      }
      const item = order.items.find((i) => i.id === item_id);
      if (!item) throw { statusCode: 404, message: 'Ligne introuvable' };
      if (String(item.status?.code).toLowerCase() === 'cancelled') throw { statusCode: 422, message: 'Ligne déjà annulée' };
      if (item.pack_id) throw { statusCode: 422, message: "Ligne d'un pack : ajustez le pack en annulant la commande (la recette d'un pack ne se modifie pas ligne par ligne)." };
      const oldQty = Number(item.qty);
      if (newQty >= oldQty) throw { statusCode: 422, message: 'Seule une réduction de quantité est possible (ajout : créer une nouvelle commande).' };
      if (newQty === 0 && !cancelledItemStatus) throw { statusCode: 500, message: 'Statut de ligne « cancelled » introuvable' };
      const activeLeft = order.items.filter((i) => i.id !== item.id && String(i.status?.code).toLowerCase() !== 'cancelled');
      if (newQty === 0 && !activeLeft.length) throw { statusCode: 422, message: 'Dernière ligne active : utilisez « Annuler la commande » (motif obligatoire).' };

      const delta = oldQty - newQty;
      const qb = Number(item.qty_backordered || 0);
      const boRelease = Math.min(qb, delta);
      const resRelease = delta - boRelease;

      if (item.sku_id) {
        await tx.$queryRaw`SELECT id FROM stock_levels WHERE node_id = ${order.node_id}::uuid AND sku_id = ${item.sku_id}::uuid FOR UPDATE`;
        const level = await tx.stockLevel.findUnique({ where: { node_id_sku_id: { node_id: order.node_id, sku_id: item.sku_id } } });
        if (level) {
          const oldRes = Number(level.qty_reserved);
          const newRes = Math.max(0, oldRes - resRelease);
          const data = {
            qty_reserved: newRes,
            qty_available: Number(level.qty_available) + (oldRes - newRes),
            qty_backordered: Math.max(0, Number(level.qty_backordered) - boRelease),
          };
          await tx.stockLevel.update({ where: { id: level.id }, data });
          await audit(req, {
            action: 'UPDATE_ORDER_LINE', resource: 'stock_levels', resource_id: level.id,
            old_values: { qty_reserved: oldRes, qty_available: Number(level.qty_available), qty_backordered: Number(level.qty_backordered) },
            new_values: { ...data, order_item_id: item.id },
          }, tx);
        }
        if (boRelease > 0) {
          const rule = await tx.sellingRule.findUnique({ where: { node_id_sku_id: { node_id: order.node_id, sku_id: item.sku_id } } });
          if (rule) {
            await tx.sellingRule.update({ where: { id: rule.id }, data: { backordered_quantity: Math.max(0, Number(rule.backordered_quantity) - boRelease) } });
          }
        }
      }

      if (item.flash_sale_id) {
        const fs = await tx.flashSale.findUnique({ where: { id: item.flash_sale_id }, select: { sold_count: true } });
        if (fs) {
          const after = Math.max(0, fs.sold_count - Math.max(1, Math.round(delta)));
          await tx.flashSale.update({ where: { id: item.flash_sale_id }, data: { sold_count: after } });
          await audit(req, { action: 'UPDATE_ORDER_LINE', resource: 'flash_sales', resource_id: item.flash_sale_id, old_values: { sold_count: fs.sold_count }, new_values: { sold_count: after } }, tx);
        }
      }

      await tx.orderItem.update({
        where: { id: item.id },
        data: newQty === 0
          ? { status_id: cancelledItemStatus.id, qty_backordered: Math.max(0, qb - boRelease) }
          : { qty: newQty, qty_backordered: Math.max(0, qb - boRelease) },
      });

      // Recalcul des montants sur les lignes actives
      const lines = await tx.orderItem.findMany({ where: { order_id }, include: { status: { select: { code: true } } } });
      let ht = 0; let vat = 0;
      for (const l of lines) {
        if (String(l.status?.code).toLowerCase() === 'cancelled') continue;
        const ttc = Number(l.unit_price_sold) * Number(l.qty) - Number(l.discount_amount || 0);
        const lineHt = ttc / (1 + Number(l.vat_rate || 0) / 100);
        ht += lineHt; vat += ttc - lineHt;
      }
      const subtotal_ht = Math.round(ht * 100) / 100;
      const vat_amount = Math.round(vat * 100) / 100;
      const subtotal_ttc = subtotal_ht + vat_amount;
      const discount = Math.min(Number(order.discount_amount || 0), subtotal_ttc);
      const total_ttc = Math.round(Math.max(0, subtotal_ttc + Number(order.delivery_fee || 0) - discount - Number(order.wallet_used || 0)) * 100) / 100;
      const isCod = Number(order.cod_amount || 0) > 0;
      await tx.order.update({
        where: { id: order_id },
        data: { subtotal_ht, vat_amount, discount_amount: discount, total_ttc, ...(isCod ? { cod_amount: total_ttc } : {}) },
      });
      const pending = order.payments.find((p) => String(p.status?.code).toLowerCase() === 'pending');
      if (pending) await tx.payment.update({ where: { id: pending.id }, data: { amount: total_ttc } });

      await audit(req, {
        action: 'UPDATE_ORDER_LINE', resource: 'orders', resource_id: order_id,
        old_values: { item_id, qty: oldQty, total_ttc: Number(order.total_ttc) },
        new_values: { item_id, qty: newQty, cancelled: newQty === 0, total_ttc, reason: motif || null, released: { reserved: resRelease, backordered: boRelease } },
      }, tx);
    }, { timeout: 30000 });

    return this.getById(order_id);
  }

  // ── Paiement (WF #30) ─────────────────────────────────────────────────────
  async collectPayment(order_id, body, req = null) {
    await L.collectPayment(order_id, body, req);
    return this.getById(order_id);
  }

  /** Vue transversale des paiements (US-060). */
  async listPayments(params = {}) {
    const page  = Math.max(1, parseInt(params.page  || 1));
    const limit = Math.min(200, Math.max(1, parseInt(params.limit || 25)));
    const where = { order: { is_deleted: false } };
    if (params.status_code) where.status = { code: { equals: params.status_code, mode: 'insensitive' } };
    if (params.method_code) where.payment_method = { code: { equals: params.method_code, mode: 'insensitive' } };
    if (params.node_id) where.order.node_id = params.node_id;
    if (params.date_from || params.date_to) {
      where.created_at = {};
      if (params.date_from) where.created_at.gte = new Date(`${params.date_from}T00:00:00.000Z`);
      if (params.date_to) {
        const end = new Date(`${params.date_to}T00:00:00.000Z`);
        end.setUTCDate(end.getUTCDate() + 1);
        where.created_at.lt = end;
      }
    }
    if (params.search?.trim()) {
      const s = params.search.trim();
      where.order.OR = [
        { customer: { name: { contains: s, mode: 'insensitive' } } },
        { customer: { phone_number: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const [data, total, sums] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          status: { select: { code: true, name_fr: true } },
          payment_method: { select: { code: true, name_fr: true } },
          order: {
            select: {
              id: true, total_ttc: true, cod_amount: true, cod_collected_at: true, created_at: true,
              status: { select: { code: true, name_fr: true } },
              customer: { select: { id: true, name: true, phone_country: true, phone_number: true } },
              node: { select: { id: true, code: true, name_fr: true } },
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where }),
      prisma.payment.groupBy({ by: ['status_id'], where, _sum: { amount: true }, _count: { _all: true } }),
    ]);
    const statuses = await prisma.paymentStatus.findMany({ select: { id: true, code: true, name_fr: true } });
    const byId = Object.fromEntries(statuses.map((s) => [s.id, s]));
    const totals = sums.map((s) => ({
      status: byId[s.status_id]?.code ?? null,
      name_fr: byId[s.status_id]?.name_fr ?? null,
      count: s._count._all,
      amount: Number(s._sum.amount ?? 0),
    }));
    return { data, totals, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  // ── Assign picker → creates session + transitions confirmed → picking ────────
  async assignPicker(order_id, picker_id, changed_by = null) {
    const picker = await prisma.picker.findFirst({
      where: { id: picker_id, is_active: true, is_deleted: false },
      select: { name: true },
    });
    const actorLabel = picker ? `le picker ${picker.name} (affectation admin)` : 'admin';
    return createPickingSessionForOrder(order_id, picker_id, changed_by, actorLabel);
  }

  // ── Confirm pickup → delivers order + collects payment + stock exit ──────────
  async confirmPickup(order_id, { payment_collected, note } = {}, req = null) {
    const changed_by = req?.user?.id ?? null;
    const order = await prisma.order.findUnique({
      where: { id: order_id },
      include: {
        status:        true,
        delivery_type: true,
        payments:      { include: { payment_method: { select: { code: true, name_fr: true } }, status: { select: { code: true } } } },
      },
    });
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
    if (normalizeCode(order.status.code) === 'DELIVERED')
      throw { statusCode: 422, message: 'Commande déjà clôturée (retrait confirmé)' };
    if (!['PICKUP', 'IN_STORE'].includes(normalizeCode(order.delivery_type?.code)))
      throw { statusCode: 422, message: "Cette commande n'est pas de type retrait magasin (pickup)" };
    if (normalizeCode(order.status.code) !== 'READY')
      throw { statusCode: 422, message: `Statut "${order.status.name_fr}" — retrait impossible (statut requis : prête)` };
    if (payment_collected !== true)
      throw { statusCode: 422, message: 'Confirmation requise : indiquez payment_collected: true après encaissement' };

    const payments = [...(order.payments ?? [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const primaryPayment = payments[0];
    if (!primaryPayment) throw { statusCode: 422, message: 'Aucun paiement enregistré pour cette commande' };

    const isCOD = ['COD', 'CASH'].includes(normalizeCode(primaryPayment.payment_method?.code));
    const payCode = normalizeCode(primaryPayment.status?.code);
    if (!['PENDING', 'COLLECTED'].includes(payCode))
      throw { statusCode: 422, message: `Statut paiement incompatible (${payCode}) — impossible de confirmer le retrait` };

    const [deliveredStatus, collectedPayStatus] = await Promise.all([
      L.mustCode('orderStatus', 'delivered', 'statut commande'),
      L.mustCode('paymentStatus', 'collected', 'statut paiement'),
    ]);
    const historyNote = note?.trim() || 'Commande retirée au magasin';
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      if (payCode === 'PENDING') {
        await tx.payment.update({
          where: { id: primaryPayment.id },
          data: { status_id: collectedPayStatus.id, collected_at: now, collected_by: 'Comptoir (retrait magasin)', notes: note?.trim() || null },
        });
      }
      await tx.order.update({
        where: { id: order_id },
        data: {
          status_id: deliveredStatus.id,
          ...(isCOD && !order.cod_collected_at ? { cod_collected_at: now } : {}),
        },
      });
      await L.applyDeliveryStock(tx, order_id, req, 'Retrait magasin — vente');
      await loyalty.creditPointsOnDelivery(tx, order.customer_id, { ...order, id: order_id }, deliveredStatus.id);
      await tx.orderHistory.create({ data: { order_id, status_id: deliveredStatus.id, changed_by, note: historyNote } });
      await audit(req, {
        action: 'UPDATE_STATUS', resource: 'orders', resource_id: order_id,
        old_values: { status: 'ready' }, new_values: { status: 'delivered', pickup: true },
      }, tx);
    }, { timeout: 30000 });

    setImmediate(() => loyalty.validateReferralOnDelivery(order.customer_id, order_id).catch(() => {}));
    notifyDelivered(order.customer_id, order_id).catch(() => {});
    return repo.findById(order_id);
  }

  async getPickersForNode(node_id) {
    return prisma.picker.findMany({
      where: { node_id, is_active: true, is_deleted: false },
      select: { id: true, name: true, phone_country: true, phone_number: true },
      orderBy: { name: 'asc' },
    });
  }

  // node_id/date optionnels : restreignent le filtre créneau de la liste.
  async meta({ node_id, date } = {}) {
    const [statusCounts, nodes, deliveryTypes, slots, paymentStatuses] = await Promise.all([
      repo.countByStatus(),
      repo.getNodes(),
      repo.getDeliveryTypes(),
      repo.getSlots({ node_id, date }),
      repo.getPaymentStatuses(),
    ]);
    return {
      status_counts: statusCounts,
      nodes,
      delivery_types: deliveryTypes,
      payment_statuses: paymentStatuses,
      slots,
    };
  }
}

module.exports = new OrderMgmtService();
