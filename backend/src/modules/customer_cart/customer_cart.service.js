const prisma = require('../../config/database');
const { getPackWithItems } = require('../pack/pack.shared');
const { toPublicUrl } = require('../../utils/fileStorage');

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

      images: {
        orderBy: [
          { sort_order: 'asc' },
          { id: 'asc' }
        ],
        take: 1,
        select: {
          image_path: true
        }
      },

      brand: {
        select: {
          id: true,
          name_fr: true,
          name_ar: true
        }
      },

      category: {
        select: {
          id: true,
          name_fr: true,
          name_ar: true
        }
      },
    },
  },
};


function applyDiscount(priceTtc, discount_type, discount_value) {
  const val = parseFloat(discount_value ?? 0);
  const isPct = discount_type === 'percentage' || discount_type === 'pourcentage';
  if (isPct)                     return Math.round(priceTtc * (1 - val / 100) * 100) / 100;
  if (discount_type === 'fixed') return Math.max(0, Math.round((priceTtc - val) * 100) / 100);
  return priceTtc;
}

async function getActiveFlashSales() {
  const now = new Date();
  return prisma.flashSale.findMany({
    where: { is_active: true, is_deleted: false, starts_at: { lte: now }, ends_at: { gte: now } },
    select: {
      sku_id: true, category_id: true, brand_id: true,
      discount_type: true, discount_value: true, flash_price: true,
    },
  });
}

function resolveFlashDiscountedPrice(skuId, article, ttc, flashSales) {
  let best = null;
  for (const fs of flashSales) {
    let candidate = null;
    if (fs.sku_id && fs.sku_id === skuId) {
      candidate = fs.flash_price != null
        ? Number(fs.flash_price)
        : applyDiscount(ttc, fs.discount_type, fs.discount_value);
    } else if (fs.category_id && fs.category_id === article?.category?.id) {
      candidate = applyDiscount(ttc, fs.discount_type, fs.discount_value);
    } else if (fs.brand_id && fs.brand_id === article?.brand?.id) {
      candidate = applyDiscount(ttc, fs.discount_type, fs.discount_value);
    }
    if (candidate != null && candidate < ttc && (best === null || candidate < best)) {
      best = candidate;
    }
  }
  return best;
}

async function getActivePackRatios() {
  const now = new Date();
  const packs = await prisma.pack.findMany({
    where: {
      is_active: true, is_deleted: false,
      OR: [{ valid_from: null }, { valid_from: { lte: now } }],
      AND: [{ OR: [{ valid_to: null }, { valid_to: { gte: now } }] }],
    },
    select: {
      id: true, name_fr: true, image_url: true, total_price: true,
      pack_items: { select: { sku_id: true, qty: true, unit_price_in_pack: true } },
    },
  });
  const map = {};
  for (const p of packs) {
    const total = Number(p.total_price ?? 0);
    const items = p.pack_items ?? [];
    const originalSum = items.reduce(
      (s, it) => s + Number(it.unit_price_in_pack ?? 0) * Number(it.qty ?? 1), 0,
    );

    const perSku = {};
    for (const it of items) {
      const baseQty       = Number(it.qty ?? 1);
      const unitOriginal   = Number(it.unit_price_in_pack ?? 0);
      const lineOriginal   = unitOriginal * baseQty;
      const share          = originalSum > 0 ? lineOriginal / originalSum : 0;
      const lineDiscounted = Math.round(total * share * 100) / 100;
      perSku[it.sku_id] = {
        baseQty,
        unitOriginal,
        unitDiscounted: baseQty > 0 ? Math.round((lineDiscounted / baseQty) * 100) / 100 : unitOriginal,
      };
    }

    map[p.id] = { name_fr: p.name_fr, image_url: toPublicUrl(p.image_url), items: perSku };
  }
  return map;
}

function formatItem(item, flashSales, packRatios) {
  const article  = item.sku?.article;
  const price    = parseFloat(article?.price    ?? 0);
  const vatRate  = parseFloat(article?.vat_rate ?? 20);
  const priceTtc = Math.round(price * (1 + vatRate / 100) * 100) / 100;
  const imageUrl = item.sku?.article?.images?.[0]?.image_path
  ? toPublicUrl(item.sku.article.images[0].image_path)
  : null;

  let finalPriceTtc = priceTtc;
  let originalPriceTtc = null;
  let packInfo = null;

  const packData = item.pack_id ? packRatios[item.pack_id] : null;
  const skuPackData = packData?.items?.[item.sku_id];

  if (packData && skuPackData) {
    finalPriceTtc    = skuPackData.unitDiscounted;
    originalPriceTtc = skuPackData.unitOriginal > finalPriceTtc ? skuPackData.unitOriginal : null;
    const bundleQty = skuPackData.baseQty > 0 ? Math.round(item.quantity / skuPackData.baseQty) : 1;
    packInfo = { id: item.pack_id, name_fr: packData.name_fr, image_url: packData.image_url, bundle_qty: bundleQty };
  } else {
    const discounted = resolveFlashDiscountedPrice(item.sku_id, article, priceTtc, flashSales);
    if (discounted != null) {
      finalPriceTtc    = discounted;
      originalPriceTtc = priceTtc;
    }
  }

  const discountPct = originalPriceTtc != null && originalPriceTtc > 0
    ? Math.round((1 - finalPriceTtc / originalPriceTtc) * 100)
    : null;

  return {
    id:       item.id,
    sku_id:   item.sku_id,
    pack:     packInfo,
    quantity: item.quantity,
    article: {
      id:                 article?.id,
      sku_code:           article?.sku_code,
      name_fr:            article?.name_fr,
      name_ar:            article?.name_ar,
      price,
      price_ttc:          finalPriceTtc,
      original_price_ttc: originalPriceTtc,
      discount_pct:       discountPct,
      vat_rate:           vatRate,
      image_url:          imageUrl,
      brand:              article?.brand    ?? null,
      category:           article?.category ?? null,
    },
    subtotal: Math.round(finalPriceTtc * item.quantity * 100) / 100,
  };
}

function formatCart(cart, flashSales, packRatios) {
  if (!cart) return { items: [], total: 0, count: 0 };
  const items = (cart.items || []).map(item => formatItem(item, flashSales, packRatios));
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
    const [cart, flashSales, packRatios] = await Promise.all([
      prisma.cart.findUnique({
        where:   { customer_id: customerId },
        include: { items: { include: { sku: { select: SKU_SELECT } } } },
      }),
      getActiveFlashSales(),
      getActivePackRatios(),
    ]);
    return formatCart(cart, flashSales, packRatios);
  }

  async addItem(customerId, skuId, quantity = 1) {
    const sku = await prisma.sku.findUnique({ where: { id: skuId } });
    if (!sku) throw { statusCode: 404, message: 'Produit introuvable' };

    const cart = await this._getOrCreate(customerId);

    const existing = await prisma.cartItem.findFirst({
      where: { cart_id: cart.id, sku_id: skuId, pack_id: null },
    });

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data:  { quantity: existing.quantity + Number(quantity) },
      });
    } else {
      await prisma.cartItem.create({
        data: { cart_id: cart.id, sku_id: skuId, pack_id: null, quantity: Number(quantity) },
      });
    }

    return this.getCart(customerId);
  }

  // Adds every item of a pack as one bundle (or `bundleQty` bundles), linked via pack_id
  // so the cart can keep applying the pack's bundle discount.
  async addPack(customerId, packId, bundleQty = 1) {
    const pack = await getPackWithItems(packId);
    if (!pack) throw { statusCode: 404, message: 'Pack introuvable' };
    if (!pack.is_active) throw { statusCode: 400, message: 'Ce pack n\'est plus disponible' };

    const now = new Date();
    if (pack.valid_from && new Date(pack.valid_from) > now) throw { statusCode: 400, message: 'Ce pack n\'est pas encore disponible' };
    if (pack.valid_to   && new Date(pack.valid_to)   < now) throw { statusCode: 400, message: 'Ce pack a expiré' };

    const cart = await this._getOrCreate(customerId);
    const qty  = Math.max(1, Number(bundleQty));

    for (const it of pack.pack_items) {
      const itemQty = Number(it.qty ?? 1) * qty;
      const existing = await prisma.cartItem.findFirst({
        where: { cart_id: cart.id, sku_id: it.sku_id, pack_id: packId },
      });
      if (existing) {
        await prisma.cartItem.update({
          where: { id: existing.id },
          data:  { quantity: existing.quantity + itemQty },
        });
      } else {
        await prisma.cartItem.create({
          data: { cart_id: cart.id, sku_id: it.sku_id, pack_id: packId, quantity: itemQty },
        });
      }
    }

    return this.getCart(customerId);
  }

  async updatePackQuantity(customerId, packId, bundleQty) {
    const cart = await prisma.cart.findUnique({ where: { customer_id: customerId } });
    if (!cart) throw { statusCode: 404, message: 'Panier introuvable' };

    const items = await prisma.cartItem.findMany({ where: { cart_id: cart.id, pack_id: packId } });
    if (!items.length) throw { statusCode: 404, message: 'Pack introuvable dans le panier' };

    const qty = Number(bundleQty);
    if (qty <= 0) {
      await prisma.cartItem.deleteMany({ where: { cart_id: cart.id, pack_id: packId } });
      return this.getCart(customerId);
    }

    const pack = await getPackWithItems(packId);
    const baseQtyBySku = Object.fromEntries((pack?.pack_items ?? []).map(it => [it.sku_id, Number(it.qty ?? 1)]));

    for (const item of items) {
      const baseQty = baseQtyBySku[item.sku_id] ?? 1;
      await prisma.cartItem.update({
        where: { id: item.id },
        data:  { quantity: baseQty * qty },
      });
    }

    return this.getCart(customerId);
  }

  async removePack(customerId, packId) {
    const cart = await prisma.cart.findUnique({ where: { customer_id: customerId } });
    if (!cart) throw { statusCode: 404, message: 'Panier introuvable' };

    await prisma.cartItem.deleteMany({ where: { cart_id: cart.id, pack_id: packId } });
    return this.getCart(customerId);
  }

  async updateItem(customerId, itemId, quantity) {
    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cart: { customer_id: customerId } },
    });
    if (!item) throw { statusCode: 404, message: 'Article introuvable dans le panier' };

    if (Number(quantity) <= 0) {
      await prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      await prisma.cartItem.update({
        where: { id: itemId },
        data:  { quantity: Number(quantity) },
      });
    }

    return this.getCart(customerId);
  }

  async removeItem(customerId, itemId) {
    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cart: { customer_id: customerId } },
    });
    if (!item) throw { statusCode: 404, message: 'Article introuvable dans le panier' };

    await prisma.cartItem.delete({ where: { id: itemId } });
    return this.getCart(customerId);
  }

  async clearCart(customerId) {
    const cart = await prisma.cart.findUnique({ where: { customer_id: customerId } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cart_id: cart.id } });
    }
    return this.getCart(customerId);
  }

  //Recommander 
  async reorderFromOrder(customerId, orderId, mode = 'merge') {
  if (!['merge', 'replace'].includes(mode)) {
    throw { statusCode: 400, message: 'Mode invalide (merge ou replace)' };
  }

  // Vérifie que la commande appartient bien au client, avec ses articles
  const order = await prisma.order.findFirst({
    where: { id: orderId, customer_id: customerId, is_deleted: false },
    include: {
      items: { select: { sku_id: true, qty: true } },
    },
  });
  if (!order) throw { statusCode: 404, message: 'Commande introuvable' };

  const availableItems = (order.items ?? []).filter((i) => i.sku_id);
  if (availableItems.length === 0) {
    throw { statusCode: 400, message: 'Aucun article de cette commande n\'est disponible' };
  }

  const cart = await this._getOrCreate(customerId);

  if (mode === 'replace') {
    await prisma.cartItem.deleteMany({ where: { cart_id: cart.id } });
  }

  for (const item of availableItems) {
    const existing = await prisma.cartItem.findFirst({
      where: { cart_id: cart.id, sku_id: item.sku_id, pack_id: null },
    });

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data:  { quantity: existing.quantity + Number(item.qty) },
      });
    } else {
      await prisma.cartItem.create({
        data: { cart_id: cart.id, sku_id: item.sku_id, pack_id: null, quantity: Number(item.qty) },
      });
    }
  }

  return this.getCart(customerId);
}
}

module.exports = new CustomerCartService();
