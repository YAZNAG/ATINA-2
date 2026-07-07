const prisma = require('../../config/database');

class CustomerSubstitutionService {

  /**
   * Récupère toutes les substitutions d'une commande pour le client.
   * Une substitution = un PickingSessionItem dont le statut est "substituted" ou "out_of_stock".
   */
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
        status:  { code: { in: ['substituted', 'out_of_stock'] } },
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

  /**
   * Substitutions en attente de réponse pour le client connecté (toutes commandes confondues).
   * "En attente" = statut substituted mais order_item pas encore status "substituted" côté client
   * (on utilise order_item.status.code === 'pending_customer_response' si dispo, sinon 'substituted')
   */
  async getPendingForCustomer(customerId) {
    const items = await prisma.pickingSessionItem.findMany({
      where: {
        status: { code: 'substituted' },
        order_item: {
          order: { customer_id: customerId },
          // pas encore confirmé/refusé par le client (PICKED = encore en attente de réponse,
          // une fois traité il devient SUBSTITUTED ou CANCELLED)
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

  /**
   * Le client répond à une substitution proposée.
   * status: 'accepted' | 'refused'
   */
  async respond(customerId, sessionItemId, status) {
    if (!['accepted', 'refused'].includes(status)) {
      throw { statusCode: 400, message: 'Statut invalide. Utiliser: accepted ou refused' };
    }

    const item = await prisma.pickingSessionItem.findUnique({
      where:  { id: sessionItemId },
      include: {
        order_item: { include: { order: { select: { customer_id: true } } } },
        status: { select: { code: true } },
      },
    });

    if (!item) throw { statusCode: 404, message: 'Substitution introuvable' };
    if (item.order_item.order.customer_id !== customerId) {
      throw { statusCode: 403, message: 'Non autorisé' };
    }
    if (item.status.code !== 'substituted') {
      throw { statusCode: 422, message: 'Cet article n\'est pas en attente de substitution' };
    }

   
    const targetCode = status === 'accepted' ? 'SUBSTITUTED' : 'CANCELLED';

    const orderItemStatus = await prisma.orderItemStatus.findUnique({
      where: { code: targetCode },
    });
    if (!orderItemStatus) {
      throw { statusCode: 500, message: `Statut order_item "${targetCode}" introuvable — vérifier le seed` };
    }

    await prisma.$transaction(async (tx) => {
      if (status === 'accepted') {
        // Remplace le sku de l'order_item par le sku substitué, statut confirmé = SUBSTITUTED
        await tx.orderItem.update({
          where: { id: item.order_item_id },
          data: {
            sku_id:    item.substitute_sku_id,
            status_id: orderItemStatus.id,
          },
        });
      } else {
        // Refus → annule l'article (statut CANCELLED)
        await tx.orderItem.update({
          where: { id: item.order_item_id },
          data: { status_id: orderItemStatus.id },
        });
      }
    });

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

    return this._formatItem(updated, status);
  }

  // ── Formatte un PickingSessionItem en objet "Substitution" pour le frontend ──
  _formatItem(item, overrideStatus) {
    const originalArticle    = item.order_item?.sku?.article;
    const substituteArticle  = item.substitute_sku?.article;

    let status = 'pending';
    if (overrideStatus) status = overrideStatus;
    else if (item.status?.code === 'out_of_stock') status = 'refused';
    else if (item.status?.code === 'substituted')  status = 'pending';

    return {
      id:              item.id,
      session_item_id: item.id,
      status,
      original_sku: originalArticle ? {
        id:        item.order_item.sku.id,
        name_fr:   originalArticle.name_fr,
        name_ar:   originalArticle.name_ar,
        price:     originalArticle.price ? Number(originalArticle.price) : null,
        image_url: item.order_item.sku.images?.[0]?.url ?? null,
      } : null,
      substitute_sku: substituteArticle ? {
        id:        item.substitute_sku.id,
        name_fr:   substituteArticle.name_fr,
        name_ar:   substituteArticle.name_ar,
        price:     substituteArticle.price ? Number(substituteArticle.price) : null,
        image_url: item.substitute_sku.images?.[0]?.url ?? null,
      } : null,
      reason:     null,
      created_at: item.picked_at ?? null,
    };
  }
}

module.exports = new CustomerSubstitutionService();