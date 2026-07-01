const prisma = require('../../config/database');
const {
  PACK_INCLUDE, computePackPrices, formatPack, getPackWithItems,
} = require('../pack/pack.shared');
const { notifyPackCreated } = require('../../utils/notify');


function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw { statusCode: 400, message: 'Le pack doit contenir au moins un article' };
  }
  return items.map((it, i) => {
    if (!it.sku_id) throw { statusCode: 400, message: `Item ${i + 1} : sku_id requis` };
    const qty = Number(it.qty ?? 1);
    if (qty <= 0) throw { statusCode: 400, message: `Item ${i + 1} : quantité invalide` };
    return { sku_id: it.sku_id, qty };
  });
}

async function fetchSkuPrices(skuIds) {
  const skus = await prisma.sku.findMany({
    where:  { id: { in: skuIds } },
    select: { id: true, article: { select: { price: true } } },
  });

  const foundIds = new Set(skus.map(s => s.id));
  const missing = skuIds.filter(id => !foundIds.has(id));
  if (missing.length > 0) {
    throw { statusCode: 400, message: `SKU(s) introuvable(s) : ${missing.join(', ')}` };
  }

  const map = {};
  skus.forEach(s => {
    const price = Number(s.article?.price ?? 0);
    if (price <= 0) throw { statusCode: 400, message: `SKU ${s.id} : prix invalide ou article sans prix` };
    map[s.id] = price;
  });
  return map;
}

async function getAll(query = {}) {
  const where = { is_deleted: false };
  if (query.node_id)   where.node_id = query.node_id;
  if (query.is_active !== undefined) {
    where.is_active = query.is_active === 'true' || query.is_active === true;
  }

  const page  = Math.max(1, parseInt(query.page  ?? '1', 10));
  const limit = Math.max(1, parseInt(query.limit ?? '20', 10));
  const skip  = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.pack.findMany({ where, include: PACK_INCLUDE, orderBy: { created_at: 'desc' }, skip, take: limit }),
    prisma.pack.count({ where }),
  ]);

  return {
    data: items.map(formatPack),
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

async function getById(id) {
  const pack = await getPackWithItems(id);
  if (!pack) throw { statusCode: 404, message: 'Pack introuvable' };
  return formatPack(pack);
}

//creer pack
async function create(body, createdBy) {
  const {
    node_id, name_fr, name_ar, description_fr, description_ar,
    discount_type, discount_value, total_price,
    valid_from, valid_to, items, image_url,
  } = body;

  if (!name_fr) throw { statusCode: 400, message: 'Nom (fr) requis' };
  if (valid_from && valid_to && new Date(valid_to) <= new Date(valid_from)) {
    throw { statusCode: 400, message: 'La date de fin doit être après la date de début' };
  }
  const normItems = normalizeItems(items);

  const skuPrices = await fetchSkuPrices(normItems.map(i => i.sku_id));

  const itemsForCalc = normItems.map(it => ({
    qty: it.qty,
    sku: { article: { price: skuPrices[it.sku_id] ?? 0 } },
    unit_price_in_pack: skuPrices[it.sku_id] ?? 0,
  }));

  const { originalPrice, finalPrice, discountPct } =
    computePackPrices(itemsForCalc, { discount_type, discount_value, total_price });

  const pack = await prisma.pack.create({
    data: {
      node_id:        node_id ?? null,
      name_fr,
      name_ar:        name_ar ?? name_fr,
      description_fr: description_fr ?? null,
      description_ar: description_ar ?? null,
      image_url:      image_url ?? null,
      total_price:    finalPrice,
      original_price: originalPrice,
      discount_pct:   discountPct,
      valid_from:     valid_from ? new Date(valid_from) : null,
      valid_to:       valid_to   ? new Date(valid_to)   : null,
      created_by:     createdBy,
      pack_items: {
        create: normItems.map((it, idx) => ({
          sku_id:             it.sku_id,
          qty:                it.qty,
          unit_price_in_pack: skuPrices[it.sku_id] ?? 0,
          sort_order:         idx,
        })),
      },
    },
    include: PACK_INCLUDE,
  });

  const formatted = formatPack(pack);
  notifyPackCreated(formatted.name_fr, formatted.total_price, formatted.discount_pct).catch(() => {});

  return formatted;
}

//modifier pack
async function update(id, body) {
  const existing = await getPackWithItems(id);
  if (!existing) throw { statusCode: 404, message: 'Pack introuvable' };

  const data = {};
  if (body.name_fr        !== undefined) data.name_fr        = body.name_fr;
  if (body.name_ar        !== undefined) data.name_ar        = body.name_ar;
  if (body.description_fr !== undefined) data.description_fr = body.description_fr;
  if (body.description_ar !== undefined) data.description_ar = body.description_ar;
  if (body.node_id        !== undefined) data.node_id        = body.node_id;
  if (body.is_active      !== undefined) data.is_active      = !!body.is_active;
  if (body.valid_from     !== undefined) data.valid_from     = body.valid_from ? new Date(body.valid_from) : null;
  if (body.valid_to       !== undefined) data.valid_to       = body.valid_to   ? new Date(body.valid_to)   : null;

  let itemsChanged = false;
  let normItems = existing.pack_items.map(it => ({ sku_id: it.sku_id, qty: Number(it.qty) }));
  if (body.items !== undefined) {
    normItems = normalizeItems(body.items);
    itemsChanged = true;
  }

  const priceChanged = body.discount_type !== undefined || body.discount_value !== undefined || body.total_price !== undefined;
  if (itemsChanged || priceChanged) {
    const skuPrices = await fetchSkuPrices(normItems.map(i => i.sku_id));
    const itemsForCalc = normItems.map(it => ({
      qty: it.qty,
      sku: { article: { price: skuPrices[it.sku_id] ?? 0 } },
      unit_price_in_pack: skuPrices[it.sku_id] ?? 0,
    }));
    const existingPct = Number(existing.discount_pct ?? 0);
    const { originalPrice, finalPrice, discountPct } = computePackPrices(itemsForCalc, {
      discount_type:  body.discount_type  ?? (existingPct > 0 ? 'percentage' : undefined),
      discount_value: body.discount_value ?? (existingPct > 0 ? existingPct   : undefined),
      total_price:    body.total_price,
    });
    data.original_price = originalPrice;
    data.total_price    = finalPrice;
    data.discount_pct   = discountPct;

    if (itemsChanged) {
      await prisma.packItem.deleteMany({ where: { pack_id: id } });
      await prisma.packItem.createMany({
        data: normItems.map((it, idx) => ({
          pack_id:            id,
          sku_id:             it.sku_id,
          qty:                it.qty,
          unit_price_in_pack: skuPrices[it.sku_id] ?? 0,
          sort_order:         idx,
        })),
      });
    }
  }

  if (body.image_url !== undefined) data.image_url = body.image_url ?? null;

  await prisma.pack.update({ where: { id }, data });

  return formatPack(await getPackWithItems(id));
}

//supprimer pack
async function remove(id) {
  const existing = await prisma.pack.findFirst({ where: { id, is_deleted: false } });
  if (!existing) throw { statusCode: 404, message: 'Pack introuvable' };

  await prisma.pack.update({
    where: { id },
    data:  { is_deleted: true, deleted_at: new Date(), is_active: false },
  });
  return { id };
}

module.exports = { getAll, getById, create, update, remove };