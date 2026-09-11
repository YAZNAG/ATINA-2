const prisma = require('../../config/database');
const { toPublicUrl } = require('../../utils/fileStorage');
const walletService = require('../wallet/wallet.service');
const { audit } = require('../../utils/audit');

const PAID_STATUS_CODES = ['paid', 'collected'];
const COD_METHOD_CODES  = ['COD', 'CASH'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Plus de relation sku.article : nom / TVA / images sont sur le SKU, le prix de vente
// est la règle de vente (selling_rules.price, TTC) du node de la ligne de commande.
const SKU_SELECT = {
  id: true, name_fr: true, name_ar: true, price: true, vat_rate: true,
  tax:           { select: { rate: true } },
  images: {
    where:   { deleted_at: null },
    orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
    take:    1,
    select:  { url: true },
  },
  selling_rules: { select: { node_id: true, price: true } },
};

const round2 = (n) => Math.round(Number(n) * 100) / 100;
const round3 = (n) => Math.round(Number(n) * 1000) / 1000;

// ── Stock : la réservation suit le SKU réellement livré (US-108 / WF #28) ───
/**
 * Libère la réservation d'une ligne (part en rupture d'abord, puis la réservation).
 * Aucune écriture stock_moves : le physique ne bouge qu'à la livraison.
 */
async function releaseLineStock(tx, { node_id, sku_id, qty, qty_backordered = 0, order_item_id }) {
  if (!sku_id || !(Number(qty) > 0)) return { reserved_released: 0, backorder_released: 0 };
  const qb = Math.min(Number(qty), Number(qty_backordered || 0));
  const resPart = Math.max(0, Number(qty) - qb);
  await tx.$queryRaw`SELECT id FROM stock_levels WHERE node_id = ${node_id}::uuid AND sku_id = ${sku_id}::uuid FOR UPDATE`;
  const level = await tx.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });
  let released = 0;
  if (level) {
    const oldRes = Number(level.qty_reserved);
    const newRes = Math.max(0, oldRes - resPart);
    released = oldRes - newRes;
    const data = {
      qty_reserved: round3(newRes),
      qty_available: round3(Number(level.qty_available) + released),
      qty_backordered: round3(Math.max(0, Number(level.qty_backordered) - qb)),
    };
    await tx.stockLevel.update({ where: { id: level.id }, data });
    await audit(null, {
      action: 'CUSTOMER_SUBSTITUTION', resource: 'stock_levels', resource_id: level.id,
      old_values: { qty_reserved: oldRes, qty_available: Number(level.qty_available), qty_backordered: Number(level.qty_backordered) },
      new_values: { ...data, sku_id, order_item_id, motif: 'Réservation libérée (produit remplacé ou refusé)' },
    }, tx);
  }
  if (qb > 0) {
    const rule = await tx.sellingRule.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });
    if (rule) {
      await tx.sellingRule.update({
        where: { id: rule.id },
        data: { backordered_quantity: round3(Math.max(0, Number(rule.backordered_quantity) - qb)) },
      });
    }
  }
  return { reserved_released: round3(released), backorder_released: round3(qb) };
}

/**
 * Réserve le produit de remplacement : le disponible est réservé, le reste passe en
 * rupture (le préparateur a déjà prélevé l'article : la substitution n'est jamais bloquée).
 */
async function reserveSubstituteStock(tx, { node_id, sku_id, qty, order_item_id }) {
  await tx.$queryRaw`SELECT id FROM stock_levels WHERE node_id = ${node_id}::uuid AND sku_id = ${sku_id}::uuid FOR UPDATE`;
  const level = await tx.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });
  const avail = level ? Math.max(0, Number(level.qty_available)) : 0;
  const reserved = Math.min(Number(qty), avail);
  const backordered = round3(Number(qty) - reserved);
  if (level) {
    await tx.stockLevel.update({
      where: { id: level.id },
      data: { qty_reserved: { increment: reserved }, qty_available: { decrement: reserved }, qty_backordered: { increment: backordered } },
    });
  } else if (backordered > 0) {
    await tx.stockLevel.create({ data: { node_id, sku_id, qty_backordered: backordered } });
  }
  if (backordered > 0) {
    const rule = await tx.sellingRule.findUnique({ where: { node_id_sku_id: { node_id, sku_id } } });
    if (rule) await tx.sellingRule.update({ where: { id: rule.id }, data: { backordered_quantity: { increment: backordered } } });
  }
  await audit(null, {
    action: 'CUSTOMER_SUBSTITUTION', resource: 'stock_levels', resource_id: level?.id ?? null,
    old_values: level ? { qty_reserved: Number(level.qty_reserved), qty_available: Number(level.qty_available) } : null,
    new_values: { sku_id, order_item_id, reserved, backordered, motif: 'Réservation du produit de remplacement accepté par le client' },
  }, tx);
  return { reserved, backordered };
}

/** Recalcul des montants et du paiement à encaisser (même règle que le back-office). */
async function recalcOrder(tx, orderId) {
  const svc = require('../orders_mgmt/order_mgmt.service');
  return svc._recalc(tx, orderId);
}

/** Prix TTC d'un SKU sur un node : règle de vente, sinon skus.price (HT) + TVA, sinon null. */
function skuNodePrice(sku, nodeId) {
  if (!sku) return null;
  const rule = (sku.selling_rules ?? []).find((r) => r.node_id === nodeId);
  if (rule && Number(rule.price) > 0) return round2(rule.price);
  if (sku.price != null) {
    const vat = Number(sku.tax?.rate ?? sku.vat_rate ?? 20);
    return round2(Number(sku.price) * (1 + vat / 100));
  }
  return null;
}

class CustomerSubstitutionService {

  async getOrderSubstitutions(customerId, orderId) {
    if (!UUID_RE.test(String(orderId))) throw { statusCode: 404, message: 'Commande introuvable' };
    const order = await prisma.order.findUnique({
      where:  { id: orderId },
      select: { id: true, customer_id: true },
    });
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
    if (order.customer_id !== customerId) throw { statusCode: 403, message: 'Non autorisé' };

    const items = await prisma.pickingSessionItem.findMany({
      where: {
        session: { order_id: orderId },
        status:  { code: { in: ['substituted', 'missing'] } },
      },
      include: {
        status: { select: { code: true, name_fr: true } },
        order_item: {
          include: {
            sku: { select: SKU_SELECT },
          },
        },
        substitute_sku: { select: SKU_SELECT },
      },
      orderBy: { picked_at: 'desc' },
    });

    return items.map(this._formatItem);
  }

  async getPendingForCustomer(customerId) {
    const items = await prisma.pickingSessionItem.findMany({
      where: {
        status: { code: 'substituted' },
        order_item: {
          order: { customer_id: customerId },
          status: { code: { notIn: ['substituted', 'cancelled', 'returned', 'delivered'] } },
        },
      },
      include: {
        status: { select: { code: true, name_fr: true } },
        order_item: {
          include: {
            order: { select: { id: true } },
            sku: { select: SKU_SELECT },
          },
        },
        substitute_sku: { select: SKU_SELECT },
      },
      orderBy: { picked_at: 'desc' },
    });

    return items.map(this._formatItem);
  }

  async respond(customerId, sessionItemId, status) {
    if (!['accepted', 'refused'].includes(status)) {
      throw { statusCode: 400, message: 'Statut invalide. Utiliser: accepted ou refused' };
    }

    if (!UUID_RE.test(String(sessionItemId))) throw { statusCode: 404, message: 'Substitution introuvable' };

    const item = await prisma.pickingSessionItem.findUnique({
      where:  { id: sessionItemId },
      include: {
        order_item: {
          include: {
            order: { select: { id: true, customer_id: true, total_ttc: true, subtotal_ht: true } },
            sku:   { select: SKU_SELECT },
          },
        },
        status: { select: { code: true } },
        substitute_sku: { select: SKU_SELECT },
      },
    });

    if (!item) throw { statusCode: 404, message: 'Substitution introuvable' };
    if (item.order_item.order.customer_id !== customerId) {
      throw { statusCode: 403, message: 'Non autorisé' };
    }
    if (item.status.code !== 'substituted') {
      throw { statusCode: 422, message: 'Cet article n\'est pas en attente de substitution' };
    }

    const targetCode = status === 'accepted' ? 'substituted' : 'cancelled';
    const orderItemStatus = await prisma.orderItemStatus.findUnique({ where: { code: targetCode } });
    if (!orderItemStatus) {
      throw { statusCode: 500, message: `Statut order_item "${targetCode}" introuvable — vérifier le seed` };
    }

    let walletCredited = 0;

    if (status === 'accepted' && !item.substitute_sku) {
      throw { statusCode: 422, message: 'Aucun produit de substitution associé' };
    }

    if (status === 'accepted') {
      const originalPrice = Number(item.order_item.unit_price_sold);
      const substitutePrice = skuNodePrice(item.substitute_sku, item.order_item.node_id) ?? originalPrice;
      const qty = Number(item.order_item.qty);

      const isCheaper = substitutePrice < originalPrice;
      const chargedUnitPrice = isCheaper ? substitutePrice : originalPrice;
      const diffTotal = isCheaper
        ? parseFloat(((originalPrice - substitutePrice) * qty).toFixed(2))
        : 0;

      const vatRate = Number(item.substitute_sku.tax?.rate ?? item.substitute_sku.vat_rate ?? 20);
      const diffHt = diffTotal > 0
        ? parseFloat((diffTotal / (1 + vatRate / 100)).toFixed(2))
        : 0;

      const paidOnline = diffTotal > 0 ? await this._isPaidOnline(item.order_item.order.id) : false;

      await prisma.$transaction(async (tx) => {
        const resolvedItemStatus = await tx.pickItemStatus.findUnique({ where: { code: 'picked' } });
        if (!resolvedItemStatus) {
          throw { statusCode: 500, message: `Statut pick_item "picked" introuvable` };
        }

        const guard = await tx.pickingSessionItem.updateMany({
          where: { id: sessionItemId, status_id: item.status_id },
          data:  { status_id: resolvedItemStatus.id },
        });
        if (guard.count === 0) {
          throw { statusCode: 409, message: 'Cette substitution a déjà été traitée' };
        }

        // Stock : la réservation de l'ancien SKU est libérée et le produit de remplacement
        // est réservé (auparavant le sku_id changeait en place sans toucher au stock).
        const oi = item.order_item;
        await releaseLineStock(tx, {
          node_id: oi.node_id, sku_id: oi.sku_id, qty: Number(oi.qty),
          qty_backordered: Number(oi.qty_backordered || 0), order_item_id: oi.id,
        });
        const subRes = await reserveSubstituteStock(tx, {
          node_id: oi.node_id, sku_id: item.substitute_sku_id, qty: Number(oi.qty), order_item_id: oi.id,
        });

        // La ligne garde son identité (la tâche de picking « substituted » la référence) :
        // elle porte désormais le SKU livré, au prix facturé, avec sa propre part en rupture.
        await tx.orderItem.update({
          where: { id: item.order_item_id },
          data: {
            sku_id:          item.substitute_sku_id,
            status_id:       orderItemStatus.id,
            unit_price_sold: chargedUnitPrice,
            qty_backordered: subRes.backordered,
            vat_rate:        vatRate,
          },
        });
        const totals = await recalcOrder(tx, item.order_item.order.id);
        await audit(null, {
          action: 'CUSTOMER_SUBSTITUTION', resource: 'order_items', resource_id: item.order_item_id,
          old_values: { sku_id: oi.sku_id, unit_price_sold: originalPrice, total_ttc: totals.old_total_ttc },
          new_values: { sku_id: item.substitute_sku_id, unit_price_sold: chargedUnitPrice, total_ttc: totals.total_ttc, response: 'accepted' },
        }, tx);

        if (diffTotal > 0) {
          if (paidOnline) {
            await walletService.refundWallet(
              {
                customer_id: customerId,
                amount:      diffTotal,
                order_id:    item.order_item.order.id,
                note:        'Remboursement suite à substitution moins chère',
              },
              tx,
            );
            walletCredited = diffTotal;
          }
        }
      });
    } else {
      await prisma.$transaction(async (tx) => {
        const resolvedItemStatus = await tx.pickItemStatus.findUnique({ where: { code: 'missing' } });
        if (!resolvedItemStatus) {
          throw { statusCode: 500, message: `Statut pick_item "missing" introuvable` };
        }

        const guard = await tx.pickingSessionItem.updateMany({
          where: { id: sessionItemId, status_id: item.status_id },
          data:  { status_id: resolvedItemStatus.id },
        });
        if (guard.count === 0) {
          throw { statusCode: 409, message: 'Cette substitution a déjà été traitée' };
        }

        await tx.orderItem.update({
          where: { id: item.order_item_id },
          data: { status_id: orderItemStatus.id, qty_backordered: 0 },
        });
        // Produit refusé : la ligne est annulée, sa réservation est libérée et le montant recalculé.
        const oi = item.order_item;
        await releaseLineStock(tx, {
          node_id: oi.node_id, sku_id: oi.sku_id, qty: Number(oi.qty),
          qty_backordered: Number(oi.qty_backordered || 0), order_item_id: oi.id,
        });
        const totals = await recalcOrder(tx, oi.order.id);
        await audit(null, {
          action: 'CUSTOMER_SUBSTITUTION', resource: 'order_items', resource_id: oi.id,
          old_values: { status: 'substituted', total_ttc: totals.old_total_ttc },
          new_values: { status: 'cancelled', total_ttc: totals.total_ttc, response: 'refused' },
        }, tx);
      });
    }

    // Après le traitement (accepted ou refused), vérifier s'il reste des
    // substitutions en attente pour CETTE commande, et reprendre le picking si non.
    const orderId = item.order_item.order.id;
    const remainingPending = await prisma.pickingSessionItem.count({
      where: {
        status: { code: 'substituted' },
        order_item: { order_id: orderId },
      },
    });

    if (remainingPending === 0) {
      const order = await prisma.order.findUnique({
        where:  { id: orderId },
        select: { status: { select: { code: true } } },
      });

      if (order?.status?.code === 'awaiting_stock') {
        const pickingStatus = await prisma.orderStatus.findUnique({ where: { code: 'picking' } });
        if (pickingStatus) {
          await prisma.$transaction([
            prisma.order.update({ where: { id: orderId }, data: { status_id: pickingStatus.id } }),
            prisma.orderHistory.create({
              data: {
                order_id: orderId,
                status_id: pickingStatus.id,
                note: 'Reprise de la préparation — toutes les substitutions ont été traitées',
              },
            }),
          ]);
        }
      }
    }

    const updated = await prisma.pickingSessionItem.findUnique({
      where: { id: sessionItemId },
      include: {
        status: { select: { code: true, name_fr: true } },
        order_item: {
          include: {
            sku: { select: SKU_SELECT },
          },
        },
        substitute_sku: { select: SKU_SELECT },
      },
    });

    const formatted = this._formatItem(updated, status);
    // après acceptation, order_item.sku_id pointe sur le substitut : on renvoie le SKU d'origine
    formatted.original_sku = this._formatItem(item, status).original_sku;
    if (walletCredited > 0) formatted.wallet_credited = walletCredited;
    return formatted;
  }

  async _isPaidOnline(orderId) {
    const payments = await prisma.payment.findMany({
      where:   { order_id: orderId },
      include: { status: true, payment_method: true },
    });

    return payments.some((p) => {
      const statusCode = (p.status?.code || '').toUpperCase();
      const methodCode = (p.payment_method?.code || '').toUpperCase();
      const isPaid = PAID_STATUS_CODES.includes(statusCode);
      const isCod  = COD_METHOD_CODES.includes(methodCode);
      return isPaid && !isCod;
    });
  }

  // ── Formatte un PickingSessionItem en objet "Substitution" pour le frontend ──
  _formatItem(item, overrideStatus) {
    const nodeId        = item.order_item?.node_id ?? null;
    const originalSku   = item.order_item?.sku ?? null;
    const substituteSku = item.substitute_sku ?? null;

    let status = 'pending';
    if (overrideStatus) status = overrideStatus;
    else if (item.status?.code === 'missing')     status = 'refused';
    else if (item.status?.code === 'substituted') status = 'pending';

    const fmtSku = (sku, fallbackPrice = null) => (sku ? {
      id:        sku.id,
      name_fr:   sku.name_fr,
      name_ar:   sku.name_ar,
      price:     skuNodePrice(sku, nodeId) ?? fallbackPrice,
      image_url: toPublicUrl(sku.images?.[0]?.url),
    } : null);

    const soldPrice = item.order_item?.unit_price_sold != null ? Number(item.order_item.unit_price_sold) : null;

    return {
      id:              item.id,
      session_item_id: item.id,
      status,
      original_sku:    fmtSku(originalSku, soldPrice),
      substitute_sku:  fmtSku(substituteSku),
      reason:     null,
      created_at: item.picked_at ?? null,
    };
  }

}

module.exports = new CustomerSubstitutionService();