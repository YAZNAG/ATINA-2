const prisma = require('../../config/database');

const SKU_SELECT = {
  id: true,
  article: {
    select: {
      id:       true,
      sku_code: true,
      name_fr:  true,
      name_ar:  true,
      price:    true,
      vat_rate: true,
      brand:    { select: { id: true, name_fr: true, name_ar: true } },
      category: { select: { id: true, name_fr: true, name_ar: true } },
    },
  },
  images: {
    orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    take:    1,
    select:  { url: true },
  },
};

function formatItem(item) {
  const article  = item.sku?.article;
  const price    = parseFloat(article?.price    ?? 0);
  const vatRate  = parseFloat(article?.vat_rate ?? 20);
  const priceTtc = Math.round(price * (1 + vatRate / 100) * 100) / 100;
  const imageUrl = item.sku?.images?.[0]?.url ?? null;

  return {
    id:       item.id,
    sku_id:   item.sku_id,
    quantity: item.quantity,
    article: {
      id:        article?.id,
      sku_code:  article?.sku_code,
      name_fr:   article?.name_fr,
      name_ar:   article?.name_ar,
      price,
      price_ttc: priceTtc,
      vat_rate:  vatRate,
      image_url: imageUrl,
      brand:     article?.brand    ?? null,
      category:  article?.category ?? null,
    },
    subtotal: Math.round(priceTtc * item.quantity * 100) / 100,
  };
}

function formatCart(cart) {
  if (!cart) return { items: [], total: 0, count: 0 };
  const items = (cart.items || []).map(formatItem);
  const total = items.reduce((s, i) => s + i.subtotal, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  return {
    id:    cart.id,
    items,
    total: Math.round(total * 100) / 100,
    count,
  };
}

class CustomerCartService {

  async _getOrCreate(customerId) {
    let cart = await prisma.cart.findUnique({ where: { customer_id: customerId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { customer_id: customerId } });
    }
    return cart;
  }

  async getCart(customerId) {
    const cart = await prisma.cart.findUnique({
      where:   { customer_id: customerId },
      include: { items: { include: { sku: { select: SKU_SELECT } } } },
    });
    return formatCart(cart);
  }

  async addItem(customerId, skuId, quantity = 1) {
    
    const sku = await prisma.sku.findUnique({ where: { id: skuId } });
    if (!sku) throw { statusCode: 404, message: 'Produit introuvable' };

    const cart = await this._getOrCreate(customerId);

    const existing = await prisma.cartItem.findUnique({
      where: { cart_id_sku_id: { cart_id: cart.id, sku_id: skuId } },
    });

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data:  { quantity: existing.quantity + Number(quantity) },
      });
    } else {
      await prisma.cartItem.create({
        data: { cart_id: cart.id, sku_id: skuId, quantity: Number(quantity) },
      });
    }

    return this.getCart(customerId);
  }

  async updateItem(customerId, skuId, quantity) {
    const cart = await prisma.cart.findUnique({ where: { customer_id: customerId } });
    if (!cart) throw { statusCode: 404, message: 'Panier introuvable' };

    if (Number(quantity) <= 0) {
      await prisma.cartItem.deleteMany({ where: { cart_id: cart.id, sku_id: skuId } });
    } else {
      await prisma.cartItem.updateMany({
        where: { cart_id: cart.id, sku_id: skuId },
        data:  { quantity: Number(quantity) },
      });
    }

    return this.getCart(customerId);
  }

  async removeItem(customerId, skuId) {
    const cart = await prisma.cart.findUnique({ where: { customer_id: customerId } });
    if (!cart) throw { statusCode: 404, message: 'Panier introuvable' };

    await prisma.cartItem.deleteMany({ where: { cart_id: cart.id, sku_id: skuId } });
    return this.getCart(customerId);
  }

  async clearCart(customerId) {
    const cart = await prisma.cart.findUnique({ where: { customer_id: customerId } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cart_id: cart.id } });
    }
    return this.getCart(customerId);
  }
}

module.exports = new CustomerCartService();