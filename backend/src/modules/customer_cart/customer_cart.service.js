const prisma = require('../../config/database');
const { getPackWithItems } = require('../pack/pack.shared');
const { applyDiscount } = require('../flash_sale/article_discount');
const { toPublicUrl } = require('../../utils/fileStorage');
const {
  isUuid, round2,
  PRIMARY_IMAGE_SELECT, primaryImageUrl,
  resolveSkuPrice, getActiveFlashSales, bestSkuFlashPrice,
  resolveCustomerNodeId, packUnavailableReason, assertPackAvailable,
} = require('./customer_cart.shared');

// Tout est porté par le SKU depuis la fusion articles → skus.
const SKU_SELECT = {
  id:          true,
  sku_code:    true,
  name_fr:     true,
  name_ar:     true,
  price:       true,
  vat_rate:    true,
  category_id: true,
  brand_id:    true,
  tax:           { select: { rate: true } },
  images:        PRIMARY_IMAGE_SELECT,
  brand:         { select: { id: true, name_fr: true, name_ar: true } },
  category:      { select: { id: true, name_fr: true, name_ar: true } },
  selling_rules: { select: { node_id: true, price: true, is_sellable: true } },
};

const PACK_SELECT = {
  id: true, name_fr: true, image_url: true, node_id: true, total_price: true,
  is_active: true, is_deleted: true, deleted_at: true, is_available: true,
  valid_from: true, valid_to: true,
  pack_items: { select: { sku_id: true, qty: true, unit_price_in_pack: true } },
};

/**
 * Répartition du prix du pack (éventuellement remisé par une vente flash ciblant le pack)
 * sur ses composants, au prorata de unit_price_in_pack × qty — même règle que le checkout.
 */
function buildPackRatios(packs, flashSales) {
  const now = new Date();
  const map = {};
  for (const p of packs) {
    const items = p.pack_items ?? [];
    const baseTotal = Number(p.total_price ?? 0);
    let total = baseTotal;
    const packFlash = flashSales.find((fs) => fs.pack_id === p.id && (!p.node_id || fs.node_id === p.node_id));
    if (packFlash) {
      const f = packFlash.flash_price != null
        ? Number(packFlash.flash_price)
        : applyDiscount(baseTotal, packFlash.discount_type, packFlash.discount_value);
      if (f < baseTotal) total = f;
    }
    const originalSum = items.reduce(
      (s, it) => s + Number(it.unit_price_in_pack ?? 0) * Number(it.qty ?? 1), 0,
    );

    const perSku = {};
    for (const it of items) {
      const baseQty        = Number(it.qty ?? 1);
      const unitOriginal   = Number(it.unit_price_in_pack ?? 0);
      const lineOriginal   = unitOriginal * baseQty;
      const share          = originalSum > 0 ? lineOriginal / originalSum : 0;
      const lineDiscounted = round2(total * share);
      perSku[it.sku_id] = {
        baseQty,
        unitOriginal,
        unitDiscounted: baseQty > 0 ? round2(lineDiscounted / baseQty) : unitOriginal,
      };
    }

    const reason = packUnavailableReason(p, now);
    map[p.id] = {
      name_fr:   p.name_fr,
      image_url: toPublicUrl(p.image_url),
      is_available: !reason,
      unavailable_reason: reason,
      items: perSku,
    };
  }
  return map;
}

function formatItem(item, ctx) {
  const { nodeId, flashSales, packRatios } = ctx;
  const sku      = item.sku;
  const base     = resolveSkuPrice(sku, nodeId);
  const vatRate  = base.vat_rate;
  const priceTtc = base.price_ttc;

  let finalPriceTtc    = priceTtc;
  let originalPriceTtc = null;
  let packInfo         = null;

  const packData    = item.pack_id ? packRatios[item.pack_id] : null;
  const skuPackData = packData?.items?.[item.sku_id];

  if (packData && skuPackData) {
    finalPriceTtc    = skuPackData.unitDiscounted;
    originalPriceTtc = skuPackData.unitOriginal > finalPriceTtc ? skuPackData.unitOriginal : null;
    const bundleQty  = skuPackData.baseQty > 0 ? Math.round(item.quantity / skuPackData.baseQty) : 1;
    packInfo = {
      id:                 item.pack_id,
      name_fr:            packData.name_fr,
      image_url:          packData.image_url,
      bundle_qty:         bundleQty,
      is_available:       packData.is_available,
      unavailable_reason: packData.unavailable_reason,
    };
  } else {
    const discounted = bestSkuFlashPrice(sku, priceTtc, flashSales);
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
    // « article » conservé pour l'app : l'id est désormais celui du SKU.
    article: {
      id:                 sku?.id,
      sku_code:           sku?.sku_code,
      name_fr:            sku?.name_fr,
      name_ar:            sku?.name_ar,
      price:              base.price_ht,
      price_ttc:          finalPriceTtc,
      original_price_ttc: originalPriceTtc,
      discount_pct:       discountPct,
      vat_rate:           vatRate,
      image_url:          primaryImageUrl(sku),
      brand:              sku?.brand    ?? null,
      category:           sku?.category ?? null,
      is_sellable:        base.is_sellable,
    },
    subtotal:   round2(finalPriceTtc * item.quantity),
    created_at: item.created_at,
  };
}

function formatCart(cart, ctx) {
  if (!cart) return { items: [], total: 0, count: 0, node_id: ctx.nodeId ?? null };
  const items = (cart.items || []).map((item) => formatItem(item, ctx));
  const total = items.reduce((s, i) => s + i.subtotal, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  return {
    id:      cart.id,
    items,
    total:   round2(total),
    count,
    node_id: ctx.nodeId ?? null,
  };
}

/** Nombre de packs (bundles) déjà présents au panier pour un pack donné. */
function bundleCount(cartItems, recipe) {
  const baseBySku = Object.fromEntries((recipe ?? []).map((it) => [it.sku_id, Number(it.qty ?? 1)]));
  let count = 0;
  for (const it of cartItems) {
    const base = baseBySku[it.sku_id] ?? 1;
    count = Math.max(count, base > 0 ? Math.round(it.quantity / base) : it.quantity);
  }
  return count;
}

class CustomerCartService {

  async _getOrCreate(customerId) {
    let cart = await prisma.cart.findUnique({ where: { customer_id: customerId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { customer_id: customerId } });
    }
    return cart;
  }

  /** @param {{ nodeId?: string }} opts node explicite (?node_id / X-Node-Id), sinon déduit. */
  async getCart(customerId, opts = {}) {
    const cart = await prisma.cart.findUnique({
      where:   { customer_id: customerId },
      include: {
        items: {
          orderBy: { created_at: 'asc' },
          include: { sku: { select: SKU_SELECT }, pack: { select: PACK_SELECT } },
        },
      },
    });

    const packs = new Map();
    for (const it of cart?.items ?? []) if (it.pack) packs.set(it.pack.id, it.pack);

    const nodeId = await resolveCustomerNodeId(customerId, {
      explicitNodeId: opts.nodeId,
      packNodeIds:    [...packs.values()].map((p) => p.node_id),
    });
    const flashSales = await getActiveFlashSales(nodeId);
    const packRatios = buildPackRatios([...packs.values()], flashSales);

    return formatCart(cart, { nodeId, flashSales, packRatios });
  }

  async addItem(customerId, skuId, quantity = 1, opts = {}) {
    if (!isUuid(skuId)) throw { statusCode: 404, message: 'Produit introuvable' };
    const sku = await prisma.sku.findFirst({
      where:  { id: skuId, is_deleted: false, deleted_at: null },
      select: { id: true, is_active: true },
    });
    if (!sku) throw { statusCode: 404, message: 'Produit introuvable' };
    if (!sku.is_active) throw { statusCode: 409, message: 'Ce produit n\'est plus disponible' };

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

    return this.getCart(customerId, opts);
  }

  async addPack(customerId, packId, bundleQty = 1, opts = {}) {
    const qty = Math.max(1, Number(bundleQty));
    if (!isUuid(packId)) throw { statusCode: 404, message: 'Pack introuvable' };

    const cart   = await this._getOrCreate(customerId);
    const inCart = await prisma.cartItem.findMany({ where: { cart_id: cart.id, pack_id: packId } });

    // US-102 : pack supprimé / inactif / is_available = false / quantité > vendable → 409
    const recipe  = await getPackWithItems(packId);
    const already = inCart.length ? bundleCount(inCart, recipe?.pack_items) : 0;
    await assertPackAvailable(packId, already + qty);

    if (!recipe?.pack_items?.length) throw { statusCode: 409, message: 'Ce pack ne contient aucun produit' };

    for (const it of recipe.pack_items) {
      const itemQty  = Math.max(1, Math.round(Number(it.qty ?? 1) * qty));
      const existing = inCart.find((c) => c.sku_id === it.sku_id);
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

    return this.getCart(customerId, opts);
  }

  async updatePackQuantity(customerId, packId, bundleQty, opts = {}) {
    const cart = await prisma.cart.findUnique({ where: { customer_id: customerId } });
    if (!cart) throw { statusCode: 404, message: 'Panier introuvable' };
    if (!isUuid(packId)) throw { statusCode: 404, message: 'Pack introuvable dans le panier' };

    const items = await prisma.cartItem.findMany({ where: { cart_id: cart.id, pack_id: packId } });
    if (!items.length) throw { statusCode: 404, message: 'Pack introuvable dans le panier' };

    const qty = Number(bundleQty);
    if (qty <= 0) {
      await prisma.cartItem.deleteMany({ where: { cart_id: cart.id, pack_id: packId } });
      return this.getCart(customerId, opts);
    }

    const pack = await getPackWithItems(packId);
    // Augmenter la quantité d'un pack indisponible est refusé (US-102) ; la baisser reste possible.
    if (qty > bundleCount(items, pack?.pack_items)) await assertPackAvailable(packId, qty);

    const baseQtyBySku = Object.fromEntries((pack?.pack_items ?? []).map((it) => [it.sku_id, Number(it.qty ?? 1)]));
    for (const item of items) {
      const baseQty = baseQtyBySku[item.sku_id] ?? 1;
      await prisma.cartItem.update({
        where: { id: item.id },
        data:  { quantity: Math.max(1, Math.round(baseQty * qty)) },
      });
    }

    return this.getCart(customerId, opts);
  }

  async removePack(customerId, packId, opts = {}) {
    const cart = await prisma.cart.findUnique({ where: { customer_id: customerId } });
    if (!cart) throw { statusCode: 404, message: 'Panier introuvable' };

    if (isUuid(packId)) await prisma.cartItem.deleteMany({ where: { cart_id: cart.id, pack_id: packId } });
    return this.getCart(customerId, opts);
  }

  async updateItem(customerId, itemId, quantity, opts = {}) {
    const item = isUuid(itemId) && await prisma.cartItem.findFirst({
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

    return this.getCart(customerId, opts);
  }

  async removeItem(customerId, itemId, opts = {}) {
    const item = isUuid(itemId) && await prisma.cartItem.findFirst({
      where: { id: itemId, cart: { customer_id: customerId } },
    });
    if (!item) throw { statusCode: 404, message: 'Article introuvable dans le panier' };

    await prisma.cartItem.delete({ where: { id: itemId } });
    return this.getCart(customerId, opts);
  }

  async clearCart(customerId, opts = {}) {
    const cart = await prisma.cart.findUnique({ where: { customer_id: customerId } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cart_id: cart.id } });
    }
    return this.getCart(customerId, opts);
  }

  // Recommander
  async reorderFromOrder(customerId, orderId, mode = 'merge', opts = {}) {
    if (!['merge', 'replace'].includes(mode)) {
      throw { statusCode: 400, message: 'Mode invalide (merge ou replace)' };
    }
    if (!isUuid(orderId)) throw { statusCode: 404, message: 'Commande introuvable' };

    const order = await prisma.order.findFirst({
      where:   { id: orderId, customer_id: customerId, is_deleted: false },
      include: {
        items: {
          select: { sku_id: true, qty: true, sku: { select: { is_active: true, is_deleted: true } } },
        },
      },
    });
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };

    const availableItems = (order.items ?? []).filter((i) => i.sku_id && i.sku && i.sku.is_active && !i.sku.is_deleted);
    if (availableItems.length === 0) {
      throw { statusCode: 400, message: 'Aucun article de cette commande n\'est disponible' };
    }

    const cart = await this._getOrCreate(customerId);

    if (mode === 'replace') {
      await prisma.cartItem.deleteMany({ where: { cart_id: cart.id } });
    }

    for (const item of availableItems) {
      const qty = Math.max(1, Math.round(Number(item.qty)));
      const existing = await prisma.cartItem.findFirst({
        where: { cart_id: cart.id, sku_id: item.sku_id, pack_id: null },
      });

      if (existing) {
        await prisma.cartItem.update({
          where: { id: existing.id },
          data:  { quantity: existing.quantity + qty },
        });
      } else {
        await prisma.cartItem.create({
          data: { cart_id: cart.id, sku_id: item.sku_id, pack_id: null, quantity: qty },
        });
      }
    }

    return this.getCart(customerId, opts);
  }
}

module.exports = new CustomerCartService();
