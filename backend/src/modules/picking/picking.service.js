const prisma = require('../../config/database');
const repo   = require('./picking.repository');

class PickingService {

  // ── Métriques ───────────────────────────────────────────────────────────────
  // Durée = completed_at − started_at ; performance = articles traités / minute et
  // taux de prélèvement (qté prélevée / qté attendue).
  _enrich(session, agg) {
    const t = agg?.totals?.[session.id];
    const items_total     = t?._count?._all ?? session._count?.items ?? session.items?.length ?? 0;
    const items_processed = agg ? (agg.processed?.[session.id] ?? 0)
      : (session.items?.filter((i) => i.status?.code !== 'pending').length ?? 0);
    const qty_expected = Number(t?._sum?.qty_expected ?? (session.items ?? []).reduce((s, i) => s + Number(i.qty_expected || 0), 0));
    const qty_picked   = Number(t?._sum?.qty_picked   ?? (session.items ?? []).reduce((s, i) => s + Number(i.qty_picked || 0), 0));
    const start = session.started_at ? new Date(session.started_at) : null;
    const end   = session.completed_at ? new Date(session.completed_at) : null;
    const duration_min = start && end ? Math.max(0, Math.round((end - start) / 60000)) : null;
    const elapsed_min  = start && !end ? Math.max(0, Math.round((Date.now() - start) / 60000)) : null;
    return {
      ...session,
      metrics: {
        items_total,
        items_processed,
        progress_pct:  items_total > 0 ? Math.round((items_processed / items_total) * 100) : 0,
        qty_expected,
        qty_picked,
        accuracy_pct:  qty_expected > 0 ? Math.round((qty_picked / qty_expected) * 100) : null,
        duration_min,
        elapsed_min,
        items_per_min: duration_min && duration_min > 0 ? Math.round((items_processed / duration_min) * 100) / 100 : null,
        error_count:   session.error_count ?? 0,
      },
    };
  }

  // ── List ────────────────────────────────────────────────────────────────────
  async listSessions(params = {}) {
    const page  = Math.max(1, parseInt(params.page || 1, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(params.limit || 25, 10) || 25));
    const { data, total } = await repo.findAllSessions({ ...params, page, limit });
    const agg = await repo.aggregateItems(data.map((s) => s.id));
    const out = { data: data.map((s) => this._enrich(s, agg)), pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
    if (params.with_counts === 'true') {
      const { status_code, page: _p, limit: _l, ...rest } = params;
      out.counts = await repo.countByStatus(rest);
    }
    return out;
  }

  /** Export (sans pagination, 5000 lignes max) — le CSV est construit côté client. */
  async exportSessions(params = {}) {
    const { data } = await repo.findAllSessions({ ...params, page: 1, limit: 5000 });
    const agg = await repo.aggregateItems(data.map((s) => s.id));
    return data.map((s) => this._enrich(s, agg));
  }

  async getSession(id) {
    const s = await repo.findSessionById(id);
    if (!s) throw { statusCode: 404, message: 'Session picking introuvable' };

    // Emplacement de prélèvement : celui de la ligne, sinon le mapping sku_node_locations du node.
    const skuIds = [...new Set((s.items ?? []).map((i) => i.order_item?.sku_id).filter(Boolean))];
    const mappings = await repo.findSkuNodeLocations(s.node_id, skuIds);
    const bySku = {};
    for (const m of mappings) (bySku[m.sku_id] ||= []).push(m);
    s.items = (s.items ?? []).map((i) => {
      const candidates = bySku[i.order_item?.sku_id] ?? [];
      return {
        ...i,
        resolved_location: i.location ?? candidates[0]?.location ?? null,
        location_source:   i.location ? 'picking_item' : (candidates[0] ? 'sku_node_locations' : null),
        sku_locations:     candidates.map((c) => ({ ...c.location, is_primary: c.is_primary_location, qty_physical: Number(c.qty_physical) })),
      };
    });
    return this._enrich(s, null);
  }

  // ── Create session from order (auto-called when order → picking) ───────────
  async createSession(order_id) {
    const order = await prisma.order.findUnique({
      where: { id: order_id },
      include: {
        status: { select: { code: true } },
        items:  { select: { id: true, sku_id: true, pack_id: true, parent_item_id: true, qty: true, status: { select: { code: true } } } },
      },
    });
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };

    // Évite les doublons de sessions actives
    const existing = await repo.findSessionByOrder(order_id);
    if (existing && ['open', 'in_progress'].includes(existing.status.code)) return existing;

    const [openStatus, pendingItemStatus, picker] = await Promise.all([
      repo.getPickingStatusByCode('open'),
      repo.getPickItemStatusByCode('pending'),
      repo.getFirstPickerForNode(order.node_id),
    ]);

    if (!openStatus)        throw { statusCode: 500, message: 'Statut "open" introuvable — seed picking_statuses' };
    if (!pendingItemStatus) throw { statusCode: 500, message: 'Statut "pending" introuvable — seed pick_item_statuses' };

    // Seules les lignes portant un SKU se prélèvent : produits seuls et COMPOSANTS de pack.
    // Jamais la ligne d'en-tête d'un pack (sku_id NULL), ni une ligne annulée ou remplacée.
    const { liveItems } = require('../orders_mgmt/order_lifecycle');
    const lines = (await liveItems(order.items)).filter((item) => item.sku_id);
    const mappings = await repo.findSkuNodeLocations(order.node_id, [...new Set(lines.map((l) => l.sku_id))]);
    const primaryLoc = {};
    for (const m of mappings) if (!primaryLoc[m.sku_id]) primaryLoc[m.sku_id] = m.location.id;

    const session = await prisma.pickingSession.create({
      data: {
        order_id,
        node_id:   order.node_id,
        picker_id: picker?.id ?? null,
        status_id: openStatus.id,
        items: {
          create: lines.map((item) => ({
            order_item_id: item.id,
            status_id:     pendingItemStatus.id,
            location_id:   primaryLoc[item.sku_id] ?? null,
            qty_expected:  item.qty,
            qty_picked:    0,
          })),
        },
      },
      select: { id: true },
    });

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
    if (['completed', 'cancelled'].includes(session.status.code))
      throw { statusCode: 422, message: `Session déjà « ${session.status.name_fr} » — annulation impossible` };
    const cancelledStatus = await repo.getPickingStatusByCode('cancelled');
    if (!cancelledStatus) throw { statusCode: 500, message: 'Statut "cancelled" introuvable — seed picking_statuses' };
    return repo.updateSession(id, { status_id: cancelledStatus.id });
  }

  // ── Pick item ─────────────────────────────────────────────────────────────
  async pickItem(item_id, { qty_picked, scanned_ean } = {}) {
    const item = await repo.findItemById(item_id);
    if (!item) throw { statusCode: 404, message: 'Article picking introuvable' };
    if (item.session.status.code !== 'in_progress')
      throw { statusCode: 422, message: 'Démarrez la session picking avant de traiter les articles' };

    // Contrôle de l'EAN scanné
    if (scanned_ean) {
      const expectedEan = item.order_item?.sku?.ean13;
      if (expectedEan && scanned_ean !== expectedEan) {
        await repo.updateSession(item.session.id, { error_count: { increment: 1 } });
        throw { statusCode: 422, message: `EAN incorrect — attendu : ${expectedEan} | scanné : ${scanned_ean}` };
      }
    }

    const pickedStatus = await repo.getPickItemStatusByCode('picked');
    if (!pickedStatus) throw { statusCode: 500, message: 'Statut article "picked" introuvable — seed pick_item_statuses' };
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
    if (!status) throw { statusCode: 500, message: 'Statut article "substituted" introuvable — seed pick_item_statuses' };

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
    const status = (await repo.getPickItemStatusByCode('out_of_stock')) ?? (await repo.getPickItemStatusByCode('missing'));
    if (!status) throw { statusCode: 500, message: 'Statut article "out_of_stock" introuvable — seed pick_item_statuses' };

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

  // ── Réassigner le picker (US-067) ─────────────────────────────────────────
  // Possible tant que la session n'est pas terminée (ni annulée) ; picker actif du même node.
  async assignPicker(session_id, picker_id) {
    const session = await repo.findSessionById(session_id);
    if (!session) throw { statusCode: 404, message: 'Session introuvable' };
    if (['completed', 'cancelled'].includes(session.status.code))
      throw { statusCode: 422, message: `Session « ${session.status.name_fr} » : la réassignation n'est plus possible` };
    if (session.picker_id === picker_id)
      throw { statusCode: 400, message: 'Ce picker est déjà assigné à la session' };

    const picker = await prisma.picker.findUnique({
      where: { id: picker_id },
      select: { id: true, name: true, node_id: true, is_active: true, is_deleted: true },
    });
    if (!picker || picker.is_deleted) throw { statusCode: 404, message: 'Picker introuvable' };
    if (!picker.is_active) throw { statusCode: 422, message: 'Ce picker est inactif : il ne peut pas être assigné' };
    if (picker.node_id !== session.node_id)
      throw { statusCode: 422, message: "Ce picker n'est pas rattaché au node de la session" };

    const updated = await repo.updateSession(session_id, { picker_id });
    return {
      session: updated,
      old_picker: session.picker ? { id: session.picker.id, name: session.picker.name } : null,
      new_picker: { id: picker.id, name: picker.name },
    };
  }
}

module.exports = new PickingService();
