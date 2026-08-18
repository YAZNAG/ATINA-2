const prisma = require('../../config/database');
const {
  FLASH_INCLUDE, computeFlashPrice, validateDiscount, formatPromo, getOriginalPrice,
} = require('../flash_sale/flash_sale.shared');
const { notifyFlashSaleCreated } = require('../../utils/notify');

async function deactivateExpired() {
  await prisma.flashSale.updateMany({
    where: { is_active: true, is_deleted: false, ends_at: { lt: new Date() } },
    data: { is_active: false },
  });
}

async function getAll(query = {}) {
  await deactivateExpired();

  const where = {};

  if (query.status === 'deleted') {
    where.is_deleted = true;
  } else {
    where.is_deleted = false;
    if (query.status === 'active')   where.is_active = true;
    if (query.status === 'inactive') where.is_active = false;
  }

  if (query.node_id)   where.node_id = query.node_id;
  if (query.scope_type === 'sku')      where.sku_id      = { not: null };
  if (query.scope_type === 'pack')     where.pack_id     = { not: null };
  if (query.scope_type === 'category') where.category_id = { not: null };
  if (query.scope_type === 'brand')    where.brand_id     = { not: null };

  if (query.search) {
    where.OR = [
      { name_fr: { contains: query.search, mode: 'insensitive' } },
      { name_ar: { contains: query.search, mode: 'insensitive' } },
      { sku: { article: { name_fr: { contains: query.search, mode: 'insensitive' } } } },
      { sku: { article: { sku_code: { contains: query.search, mode: 'insensitive' } } } },
    ];
  }

  const page  = Math.max(1, parseInt(query.page  ?? '1', 10));
  const limit = Math.max(1, parseInt(query.limit ?? '20', 10));
  const skip  = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.flashSale.findMany({
      where, include: FLASH_INCLUDE,
      orderBy: { created_at: 'desc' },
      skip, take: limit,
    }),
    prisma.flashSale.count({ where }),
  ]);

  return {
    data: items.map(formatPromo),
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

async function getById(id) {
  await deactivateExpired();
  const fs = await prisma.flashSale.findFirst({
    where: { id },
    include: FLASH_INCLUDE,
  });
  if (!fs) throw { statusCode: 404, message: 'Promotion introuvable' };
  return formatPromo(fs);
}

//creer une promotion (sku, pack, categorie ou marque)
async function CreatePromotion(body, createdBy) {
  const {
    sku_id, pack_id, category_id, brand_id,
    node_id, name_fr, name_ar, image_url,
    discount_type = 'fixed', discount_value,
    stock_flash, max_qty_per_user = 1,
    starts_at, ends_at,
  } = body;

  const scopeIds = [sku_id, pack_id, category_id, brand_id].filter(v => v !== undefined && v !== null && v !== '');
  if (scopeIds.length !== 1) {
    throw { statusCode: 400, message: 'Renseignez exactement un scope : sku_id, pack_id, category_id ou brand_id' };
  }
  if (!node_id)          throw { statusCode: 400, message: 'node_id requis' };
  if (discount_value == null) throw { statusCode: 400, message: 'discount_value requis' };
  if (!starts_at || !ends_at) throw { statusCode: 400, message: 'Dates de début et fin requises' };
  if (new Date(ends_at) <= new Date(starts_at)) {
    throw { statusCode: 400, message: 'La date de fin doit être après la date de début' };
  }

  let flash_price = null;
  if (sku_id) {
    const originalPrice = await getOriginalPrice(sku_id);
    flash_price = computeFlashPrice(originalPrice, discount_type, discount_value);
  } else {
    validateDiscount(discount_type, discount_value);
    if (category_id) {
      const cat = await prisma.category.findUnique({ where: { id: Number(category_id) } });
      if (!cat) throw { statusCode: 404, message: 'Catégorie introuvable' };
    }
    if (brand_id) {
      const brand = await prisma.brand.findUnique({ where: { id: Number(brand_id) } });
      if (!brand) throw { statusCode: 404, message: 'Marque introuvable' };
    }
  }

  const created = await prisma.flashSale.create({
    data: {
      sku_id:           sku_id ?? null,
      pack_id:          pack_id ?? null,
      category_id:      category_id != null ? Number(category_id) : null,
      brand_id:         brand_id != null ? Number(brand_id) : null,
      node_id,
      name_fr:          name_fr ?? null,
      name_ar:          name_ar ?? null,
      image_url:        image_url ?? null,
      discount_type,
      discount_value:   discount_value != null ? Number(discount_value) : null,
      flash_price,
      stock_flash:      sku_id ? Number(stock_flash ?? 0) : null,
      max_qty_per_user: Number(max_qty_per_user ?? 1),
      starts_at:        new Date(starts_at),
      ends_at:          new Date(ends_at),
      created_by:       createdBy,
    },
    include: FLASH_INCLUDE,
  });

  const formatted = formatPromo(created);

  const isPct = formatted.discount_type === 'percentage' || formatted.discount_type === 'pourcentage';
  const discountLabel = isPct ? `-${formatted.discount_value}%` : `-${formatted.discount_value} MAD`;
  notifyFlashSaleCreated(
    discountLabel,
    formatted.scope_name ?? formatted.name_fr ?? 'une sélection de produits',
    new Date(formatted.ends_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
  ).catch(() => {});

  return formatted;
}

//modifier promotion
async function updatePromotion(id, body) {
  const existing = await prisma.flashSale.findFirst({
    where: { id, is_deleted: false },
  });
  if (!existing) throw { statusCode: 404, message: 'Promotion introuvable' };

  const scopeType = existing.sku_id ? 'sku'
    : existing.pack_id ? 'pack'
    : existing.category_id ? 'category'
    : existing.brand_id ? 'brand'
    : 'unknown';

  const data = {};
  if (body.name_fr          !== undefined) data.name_fr          = body.name_fr;
  if (body.name_ar          !== undefined) data.name_ar          = body.name_ar;
  if (body.image_url        !== undefined) data.image_url        = body.image_url;
  if (body.stock_flash      !== undefined) data.stock_flash      = Number(body.stock_flash);
  if (body.max_qty_per_user !== undefined) data.max_qty_per_user = Number(body.max_qty_per_user);
  if (body.is_active        !== undefined) data.is_active        = !!body.is_active;
  if (body.starts_at        !== undefined) data.starts_at        = new Date(body.starts_at);
  if (body.ends_at          !== undefined) data.ends_at          = new Date(body.ends_at);

  if (body.discount_type !== undefined || body.discount_value !== undefined) {
    const discount_type  = body.discount_type  ?? existing.discount_type;
    const discount_value = body.discount_value ?? existing.discount_value;

    if (scopeType === 'sku') {
      const originalPrice = await getOriginalPrice(existing.sku_id);
      data.flash_price = computeFlashPrice(originalPrice, discount_type, discount_value);
    } else {
      validateDiscount(discount_type, discount_value);
    }

    data.discount_type  = discount_type;
    data.discount_value = discount_value != null ? Number(discount_value) : null;
  }

  const start = data.starts_at ?? existing.starts_at;
  const end   = data.ends_at   ?? existing.ends_at;
  if (new Date(end) <= new Date(start)) {
    throw { statusCode: 400, message: 'La date de fin doit être après la date de début' };
  }

  const updated = await prisma.flashSale.update({
    where: { id }, data, include: FLASH_INCLUDE,
  });
  return formatPromo(updated);
}

//supprimer promotion
async function removePromotion(id) {
  const existing = await prisma.flashSale.findFirst({ where: { id, is_deleted: false } });
  if (!existing) throw { statusCode: 404, message: 'Promotion introuvable' };

  await prisma.flashSale.update({
    where: { id },
    data:  { is_deleted: true, deleted_at: new Date(), is_active: false },
  });
  return { id };
}

module.exports = { getAll, getById, CreatePromotion, updatePromotion, removePromotion };
