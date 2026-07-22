const prisma = require('../../config/database');
const { toPublicUrl } = require('../../utils/fileStorage');
const walletService = require('../wallet/wallet.service');

const PAID_STATUS_CODES = ['PAID', 'COLLECTED']; 
const COD_METHOD_CODES  = ['COD', 'CASH'];   

class CustomerSubstitutionService {

  async getOrderSubstitutions(customerId, orderId) {
    // Vérifie que la commande appartient bien au client
    const order = await prisma.order.findUnique({
      where:  { id: orderId },
      select: { id: true, customer_id: true },
    });
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
    if (order.customer_id !== customerId) throw { statusCode: 403, message: 'Non autorisé' };

    const items = await prisma.pickingSessionItem.findMany({
      where: {
        session: { order_id: orderId },
        status:  { code: { in: ['SUBSTITUTED', 'MISSING'] } },
      },
      include: {
        status: { select: { code: true, name_fr: true } },
        order_item: {
          include: {
            sku: {
              include: {
                article: { select: { name_fr: true, name_ar: true, price: true } },
                images:  { where: { is_primary: true }, take: 1 },
              },
            },
          },
        },
        substitute_sku: {
          include: {
            article: { select: { name_fr: true, name_ar: true, price: true } },
            images:  { where: { is_primary: true }, take: 1 },
          },
        },
      },
      orderBy: { picked_at: 'desc' },
    });

    return items.map(this._formatItem);
  }

  async getPendingForCustomer(customerId) {
    const items = await prisma.pickingSessionItem.findMany({
      where: {
        status: { code: 'SUBSTITUTED' },
        order_item: {
          order: { customer_id: customerId },
          status: { code: { notIn: ['SUBSTITUTED', 'CANCELLED', 'RETURNED', 'DELIVERED'] } },
        },
      },
      include: {
        status: { select: { code: true, name_fr: true } },
        order_item: {
          include: {
            order: { select: { id: true } },
            sku: {
              include: {
                article: { select: { name_fr: true, name_ar: true, price: true } },
                images:  { where: { is_primary: true }, take: 1 },
              },
            },
          },
        },
        substitute_sku: {
          include: {
            article: { select: { name_fr: true, name_ar: true, price: true } },
            images:  { where: { is_primary: true }, take: 1 },
          },
        },
      },
      orderBy: { picked_at: 'desc' },
    });

    return items.map(this._formatItem);
  }

  async respond(customerId, sessionItemId, status) {
    if (!['accepted', 'refused'].includes(status)) {
      throw { statusCode: 400, message: 'Statut invalide. Utiliser: accepted ou refused' };
    }

    const item = await prisma.pickingSessionItem.findUnique({
      where:  { id: sessionItemId },
      include: {
        order_item: {
          include: {
            order: { select: { id: true, customer_id: true, total_ttc: true, subtotal_ht: true } },
          },
        },
        status: { select: { code: true } },
        substitute_sku: { include: { article: { select: { price: true } } } },
      },
    });

    if (!item) throw { statusCode: 404, message: 'Substitution introuvable' };
    if (item.order_item.order.customer_id !== customerId) {
      throw { statusCode: 403, message: 'Non autorisé' };
    }
    if (item.status.code !== 'SUBSTITUTED') {
      throw { statusCode: 422, message: 'Cet article n\'est pas en attente de substitution' };
    }

    const targetCode = status === 'accepted' ? 'SUBSTITUTED' : 'CANCELLED';
    const orderItemStatus = await prisma.orderItemStatus.findUnique({ where: { code: targetCode } });
    if (!orderItemStatus) {
      throw { statusCode: 500, message: `Statut order_item "${targetCode}" introuvable — vérifier le seed` };
    }

    let walletCredited = 0;

    if (status === 'accepted') {
      const originalPrice = Number(item.order_item.unit_price_sold);
      const substitutePrice = item.substitute_sku.article.price != null
        ? Number(item.substitute_sku.article.price)
        : originalPrice;
      const qty = Number(item.order_item.qty);

      // Le substitut est moins cher → on recalcule ; plus cher ou égal → on garde le prix initial
      const isCheaper = substitutePrice < originalPrice;
      const chargedUnitPrice = isCheaper ? substitutePrice : originalPrice;
      const diffTotal = isCheaper
        ? parseFloat(((originalPrice - substitutePrice) * qty).toFixed(2))
        : 0;

      await prisma.$transaction(async (tx) => {
        await tx.orderItem.update({
          where: { id: item.order_item_id },
          data: {
            sku_id:          item.substitute_sku_id,
            status_id:       orderItemStatus.id,
            unit_price_sold: chargedUnitPrice,
          },
        });

        if (diffTotal > 0) {
          const order = item.order_item.order;
          await tx.order.update({
            where: { id: order.id },
            data: {
              subtotal_ht: { decrement: diffTotal },
              total_ttc:   { decrement: diffTotal },
            },
          });
        }
      });

      if (diffTotal > 0) {
        const paidOnline = await this._isPaidOnline(item.order_item.order.id);
        if (paidOnline) {
          await walletService.refundWallet({
            customer_id: customerId,
            amount:      diffTotal,
            order_id:    item.order_item.order.id,
            note:        'Remboursement suite à substitution moins chère',
          });
          walletCredited = diffTotal;
        }
        // Si COD, rien à faire de plus : le total de la commande est déjà réduit,
        // le client paiera simplement moins à la livraison.
      }
    } else {
      // Refus → annule l'article (statut CANCELLED)
      await prisma.orderItem.update({
        where: { id: item.order_item_id },
        data: { status_id: orderItemStatus.id },
      });
    }

    const updated = await prisma.pickingSessionItem.findUnique({
      where: { id: sessionItemId },
      include: {
        status: { select: { code: true, name_fr: true } },
        order_item: {
          include: {
            sku: { include: { article: { select: { name_fr: true, price: true } }, images: { where: { is_primary: true }, take: 1 } } },
          },
        },
        substitute_sku: {
          include: { article: { select: { name_fr: true, price: true } }, images: { where: { is_primary: true }, take: 1 } },
        },
      },
    });

    const formatted = this._formatItem(updated, status);
    if (walletCredited > 0) formatted.wallet_credited = walletCredited;
    return formatted;
  }

  // ── Détecte si la commande a déjà été payée en ligne (carte), vs COD ─────────
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
    const originalArticle    = item.order_item?.sku?.article;
    const substituteArticle  = item.substitute_sku?.article;

    let status = 'pending';
    if (overrideStatus) status = overrideStatus;
    else if (item.status?.code === 'out_of_stock') status = 'refused';
    else if (item.status?.code === 'SUBSTITUTED')  status = 'pending';

    return {
      id:              item.id,
      session_item_id: item.id,
      status,
      original_sku: originalArticle ? {
        id:        item.order_item.sku.id,
        name_fr:   originalArticle.name_fr,
        name_ar:   originalArticle.name_ar,
        price:     originalArticle.price ? Number(originalArticle.price) : null,
        image_url: toPublicUrl(item.order_item.sku.images?.[0]?.url),
      } : null,
      substitute_sku: substituteArticle ? {
        id:        item.substitute_sku.id,
        name_fr:   substituteArticle.name_fr,
        name_ar:   substituteArticle.name_ar,
        price:     substituteArticle.price ? Number(substituteArticle.price) : null,
        image_url: toPublicUrl(item.substitute_sku.images?.[0]?.url),
      } : null,
      reason:     null,
      created_at: item.picked_at ?? null,
    };
  }
}

module.exports = new CustomerSubstitutionService();