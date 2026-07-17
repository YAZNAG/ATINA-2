const prisma = require('../../config/database');
const bcrypt = require('bcrypt');
const fs     = require('fs');
const path   = require('path');
const { getActiveFlashSales, resolveArticleDiscount } = require('../flash_sale/article_discount');
const BASE_URL = process.env.BASE_URL || 'http://192.168.1.17:5000/';

async function getProfile(customerId) {
  const customer = await prisma.customer.findFirst({
    where:  { id: customerId, is_deleted: false },
    select: {
      id: true, name: true, phone_country: true, phone_number: true,
      preferred_lang: true, city: true, avatar_url: true, lat: true, lng: true,
      wallet_balance: true, points_balance: true, points_lifetime: true,
      referral_code: true, is_active: true, created_at: true,
      user: { select: { phone_verified_at: true, email: true } },
      _count: { select: { addresses: { where: { is_deleted: false } } } },
    },
  });
  if (!customer) throw { statusCode: 404, message: 'Client introuvable' };

  return {
    id:             customer.id,
    name:           customer.name,
    phone_country:  customer.phone_country,
    phone_number:   customer.phone_number,
    email:          customer.user?.email,
    preferred_lang: customer.preferred_lang,
    city:           customer.city,
    avatar_url:     customer.avatar_url ?? null,
    lat:            customer.lat != null ? String(customer.lat) : null,
    lng:            customer.lng != null ? String(customer.lng) : null,
    wallet_balance: Number(customer.wallet_balance ?? 0),
    points_balance: Number(customer.points_balance ?? 0),
    points_lifetime:Number(customer.points_lifetime ?? 0),
    referral_code:  customer.referral_code,
    is_active:      customer.is_active,
    phone_verified: !!customer.user?.phone_verified_at,
    address_count:  customer._count.addresses,
    created_at:     customer.created_at,
  };
}

async function updateProfile(customerId, body) {
  const data = {};
  if (body.name           !== undefined) data.name           = String(body.name || '').trim();
  if (body.preferred_lang !== undefined) data.preferred_lang = body.preferred_lang === 'ar' ? 'ar' : 'fr';
  if (body.city           !== undefined) data.city           = body.city ? String(body.city).trim() : null;
  if (body.lat            !== undefined) data.lat            = body.lat  ?? null;
  if (body.lng            !== undefined) data.lng            = body.lng  ?? null;

  if (data.name === '') throw { statusCode: 400, message: 'Nom invalide' };
  if (!Object.keys(data).length) throw { statusCode: 400, message: 'Aucun champ à mettre à jour' };

  await prisma.customer.update({ where: { id: customerId }, data });
  return getProfile(customerId);
}

// Addresses
async function listAddresses(customerId) {
  return prisma.address.findMany({
    where:   { customer_id: customerId, is_deleted: false },
    orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
  });
}

async function createAddress(customerId, body) {
  const street_name = String(body.street_name || '').trim();
  if (!street_name) throw { statusCode: 400, message: 'Nom de rue requis' };
  const city = String(body.city || '').trim();
  if (!city) throw { statusCode: 400, message: 'Ville requise' };

  const existing   = await listAddresses(customerId);
  const isDefault  = existing.length === 0 || body.is_default === true || body.is_default === 'true';

  if (isDefault) {
    await prisma.address.updateMany({
      where: { customer_id: customerId, is_default: true },
      data:  { is_default: false },
    });
  }

  const trunc = (s, max) => s ? String(s).trim().slice(0, max) : null;
  return prisma.address.create({
    data: {
      customer_id:    customerId,
      label:          trunc(body.label,          100),
      recipient_name: trunc(body.recipient_name, 150),
      phone:          trunc(body.phone,           30),
      street_number:  trunc(body.street_number,   20),
      street_name:    trunc(street_name,          255),
      quartier:       trunc(body.quartier,        100),
      city:           trunc(city,                 100),
      postal_code:    trunc(body.postal_code,       5),
      lat:            body.lat  ?? null,
      lng:            body.lng  ?? null,
      delivery_notes: body.delivery_notes ? String(body.delivery_notes).trim() : null,
      is_default:     isDefault,
    },
  });
}

async function updateAddress(customerId, addressId, body) {
  const addr = await prisma.address.findFirst({ where: { id: addressId, customer_id: customerId, is_deleted: false } });
  if (!addr) throw { statusCode: 404, message: 'Adresse introuvable' };

  const trunc = (s, max) => s ? String(s).trim().slice(0, max) : null;
  const data  = {};
  if (body.label          !== undefined) data.label          = trunc(body.label, 100);
  if (body.recipient_name !== undefined) data.recipient_name = trunc(body.recipient_name, 150);
  if (body.phone          !== undefined) data.phone          = trunc(body.phone, 30);
  if (body.street_number  !== undefined) data.street_number = trunc(body.street_number, 20);
  if (body.street_name    !== undefined) {
    const s = String(body.street_name || '').trim();
    if (!s) throw { statusCode: 400, message: 'Nom de rue requis' };
    data.street_name = s.slice(0, 255);
  }
  if (body.quartier       !== undefined) data.quartier      = trunc(body.quartier, 100);
  if (body.city           !== undefined) {
    const c = String(body.city || '').trim();
    if (!c) throw { statusCode: 400, message: 'Ville requise' };
    data.city = c.slice(0, 100);
  }
  if (body.postal_code    !== undefined) data.postal_code    = trunc(body.postal_code, 5);
  if (body.lat            !== undefined) data.lat            = body.lat ?? null;
  if (body.lng            !== undefined) data.lng            = body.lng ?? null;
  if (body.delivery_notes !== undefined) data.delivery_notes = body.delivery_notes ? String(body.delivery_notes).trim() : null;

  return prisma.address.update({ where: { id: addressId }, data });
}

async function setDefaultAddress(customerId, addressId) {
  const addr = await prisma.address.findFirst({ where: { id: addressId, customer_id: customerId, is_deleted: false } });
  if (!addr) throw { statusCode: 404, message: 'Adresse introuvable' };
  await prisma.address.updateMany({ where: { customer_id: customerId, is_default: true }, data: { is_default: false } });
  return prisma.address.update({ where: { id: addressId }, data: { is_default: true } });
}

async function deleteAddress(customerId, addressId) {
  const addr = await prisma.address.findFirst({ where: { id: addressId, customer_id: customerId, is_deleted: false } });
  if (!addr) throw { statusCode: 404, message: 'Adresse introuvable' };
  await prisma.address.update({ where: { id: addressId }, data: { is_deleted: true } });
  // If deleted was default, promote next address
  if (addr.is_default) {
    const next = await prisma.address.findFirst({ where: { customer_id: customerId, is_deleted: false } });
    if (next) await prisma.address.update({ where: { id: next.id }, data: { is_default: true } });
  }
  return { id: addressId };
}

// Orders
const ORDER_LIST_INCLUDE = {
  status:        { select: { id: true, code: true, name_fr: true, name_ar: true, color: true } },
  delivery_type: { select: { id: true, code: true, name_fr: true } },
  node:          { select: { id: true, name_fr: true } },
  _count:        { select: { items: true } },
  payments: {
    take: 1,
    orderBy: { created_at: 'desc' },
    include: {
      status:         { select: { code: true, name_fr: true } },
      payment_method: { select: { code: true, name_fr: true } },
    },
  },
items: {
  take: 4,
  select: {
    sku: {
      select: {
        article: {
          select: {
            images: {
              where:   { is_main: true, deleted_at: null },
              select:  { image_path: true },
              take:    1,
            },
          },
        },
      },
    },
  },
},
};

const ORDER_DETAIL_INCLUDE = {
  status:        { select: { id: true, code: true, name_fr: true, name_ar: true, color: true } },
  delivery_type: { select: { id: true, code: true, name_fr: true } },
  node:          { select: { id: true, name_fr: true } },
  address:       true,
  confirmed_slot: { select: { id: true, name_fr: true, slot_start: true, slot_end: true, day_of_week: true } },
  items: {
    include: {
      sku: {
        select: {
          id: true,
          article: {
            select: {
              name_fr: true,
              sku_code: true,
              price: true,
              images: {
                where:  { is_main: true, deleted_at: null },
                select: { image_path: true },
                take:   1,
              },
            },
          },
        },
      },
    },
  },
  payments: {
    orderBy: { created_at: 'desc' },
    include: {
      status:         { select: { code: true, name_fr: true } },
      payment_method: { select: { code: true, name_fr: true } },
    },
  },
  history: {
    include: { status: { select: { code: true, name_fr: true, color: true } } },
    orderBy: { created_at: 'asc' },
  },
  tour: {
    include: {
      driver: {
        select: {
          id: true, name: true,
          phone_country: true, phone_number: true,
          vehicle_type: true, vehicle_plate: true,
        },
      },
    },
  },
  tour_stops: {
    take: 1,
    include: { status: { select: { code: true, name_fr: true } } },
  },
  coupon_redemptions: {
  take: 1,
  select: {
    discount_applied: true,
    promotion: { select: { code: true } },
  },
},
};

function formatOrderList(o) {
  const payment = o.payments?.[0];
  return {
    id:            o.id,
    reference:     o.reference ?? o.id.slice(0, 8).toUpperCase(),
    created_at:    o.created_at,
    delivery_type: o.delivery_type?.code ?? 'home',
    node_name:     o.node?.name_fr,
    total_ttc:     Number(o.total_ttc ?? 0),
    status:        o.status,
    payment_status: payment?.status?.code ?? 'pending',
    payment_status_label: payment?.status?.name_fr ?? 'En attente',
    payment_method_name: payment?.payment_method?.name_fr,
    item_count:    o._count?.items ?? 0,
    items: (o.items ?? []).map(item => {
  const imagePath = item.sku?.article?.images?.[0]?.image_path ?? null;
  return {
    image_url: imagePath
      ? `${BASE_URL}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`
      : null,
  };
}),
  };
}

function formatOrderDetail(o) {
  const payment = o.payments?.[0];
  const slot    = o.confirmed_slot;
  const address = o.address;
  return {
    id:            o.id,
    reference:     o.reference ?? o.id.slice(0, 8).toUpperCase(),
    created_at:    o.created_at,
    delivery_type: o.delivery_type?.code ?? 'home',
    node_name:     o.node?.name_fr,
    total_ttc:     Number(o.total_ttc ?? 0),
    delivery_fee:  Number(o.delivery_fee ?? 0),
    wallet_used:   Number(o.wallet_used ?? 0),
    notes:         o.notes,
    status:        o.status,
    discount_amount: Number(o.coupon_redemptions?.[0]?.discount_applied ?? 0),
    coupon_code:     o.coupon_redemptions?.[0]?.promotion?.code ?? null,
    payment_status: payment?.status?.code ?? 'pending',
    payment_status_label: payment?.status?.name_fr ?? 'En attente',
    payment_method_name: payment?.payment_method?.name_fr,
    address_label: address?.label,
    address_full:  [address?.street_number, address?.street_name, address?.quartier, address?.city]
      .filter(Boolean).join(', '),
    slot_name:     slot?.name_fr,
    slot_date:     null,
    items: (o.items ?? []).map(item => {
  const imagePath = item.sku?.article?.images?.[0]?.image_path ?? null;
  const image_url = imagePath
    ? `${BASE_URL}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`
    : null;
  return {
    id:         item.id,
    sku_code:   item.sku?.article?.sku_code,
    name_fr:    item.sku?.article?.name_fr ?? 'Article',
    qty:        item.qty,
    unit_price: Number(item.unit_price_sold ?? 0),
    vat_rate:   Number(item.vat_rate ?? 0),
    total_ttc:  Number(item.unit_price_sold ?? 0) * (item.qty ?? 1),
    image_url,
  };}),
    timeline: (o.history ?? []).map(h => ({
      status_code: h.status?.code,
      name_fr:     h.status?.name_fr,
      color:       h.status?.color,
      created_at:  h.created_at,
      note:        h.note,
    })),
    driver: o.tour?.driver ? {
      name:          o.tour.driver.name,
      phone:         (o.tour.driver.phone_country ?? '') + (o.tour.driver.phone_number ?? ''),
      vehicle_type:  o.tour.driver.vehicle_type ?? null,
      vehicle_plate: o.tour.driver.vehicle_plate ?? null,
    } : null,
    slot_start: o.tour?.slot_start ?? o.slot_start ?? null,
    slot_end:   o.tour?.slot_end   ?? o.slot_end   ?? null,
    stop_status: o.tour_stops?.[0]?.status?.code ?? null,
  };
  
}

async function listOrders(customerId) {
  const orders = await prisma.order.findMany({
    where:   { customer_id: customerId, is_deleted: false },
    include: ORDER_LIST_INCLUDE,
    orderBy: { created_at: 'desc' },
  });
  return orders.map(formatOrderList);
}

async function getOrderById(customerId, orderId) {
  const order = await prisma.order.findFirst({
    where:   { id: orderId, customer_id: customerId, is_deleted: false },
    include: ORDER_DETAIL_INCLUDE,
  });
  if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
  return formatOrderDetail(order);
}


async function getUserId(customerId) {
  const customer = await prisma.customer.findFirst({
    where:  { id: customerId, is_deleted: false },
    select: { user_id: true },
  });
  if (!customer?.user_id) throw { statusCode: 404, message: 'Utilisateur introuvable' };
  return customer.user_id;
}
 
// Email
async function updateEmail(customerId, body) {
  const email = String(body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) throw { statusCode: 400, message: 'Email invalide' };
 
  const userId = await getUserId(customerId);
 
  // Vérifie unicité
  const existing = await prisma.user.findFirst({
    where: { email, id: { not: userId } },
    select: { id: true },
  });
  if (existing) throw { statusCode: 409, message: 'Cet email est déjà utilisé' };
 
  await prisma.user.update({ where: { id: userId }, data: { email } });
  return { message: 'Email mis à jour' };
}
 
// Téléphone : étape 1 — demande OTP (test = 0000)
async function requestPhoneChange(customerId, body) {
  const phone_country = String(body.phone_country || '+212').trim();
  const phone_number  = String(body.phone_number || '').trim();
  if (!phone_number) throw { statusCode: 400, message: 'Numéro requis' };
 
  const userId = await getUserId(customerId);
 
  // Vérifie que le numéro n'est pas déjà pris par un autre user
  const existing = await prisma.user.findFirst({
    where: { phone_country, phone_number, id: { not: userId } },
    select: { id: true },
  });
  if (existing) throw { statusCode: 409, message: 'Ce numéro est déjà utilisé' };
 
  // En prod : générer un vrai code + envoyer SMS. Ici test = 0000
  await prisma.user.update({
    where: { id: userId },
    data:  { otp_code: '0000', otp_expires_at: new Date(Date.now() + 10 * 60000) },
  });
  return { message: 'Code de vérification envoyé' };
}
 
// Téléphone : étape 2 — vérifie OTP + met à jour
async function confirmPhoneChange(customerId, body) {
  const phone_country = String(body.phone_country || '+212').trim();
  const phone_number  = String(body.phone_number || '').trim();
  const otp           = String(body.otp || '').trim();
  if (!phone_number) throw { statusCode: 400, message: 'Numéro requis' };
  if (!otp)          throw { statusCode: 400, message: 'Code requis' };
 
  const userId = await getUserId(customerId);
 
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { otp_code: true, otp_expires_at: true },
  });
  if (user.otp_code !== otp) throw { statusCode: 400, message: 'Code incorrect' };
  if (user.otp_expires_at && user.otp_expires_at < new Date())
    throw { statusCode: 400, message: 'Code expiré, redemandez-en un' };
 
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data:  {
        phone_country, phone_number,
        phone_verified_at: new Date(),
        otp_code: null, otp_expires_at: null,
      },
    }),
    prisma.customer.update({
      where: { id: customerId },
      data:  { phone_country, phone_number, phone_verified_at: new Date() },
    }),
  ]);
  return { message: 'Téléphone mis à jour' };
}
 
// Mot de passe
async function changePassword(customerId, body) {
  const old_password = String(body.old_password || '');
  const new_password = String(body.new_password || '');
  if (!old_password || !new_password) throw { statusCode: 400, message: 'Champs requis' };
  if (new_password.length < 6) throw { statusCode: 400, message: 'Min. 6 caractères' };
 
  const userId = await getUserId(customerId);
 
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { password_hash: true },
  });
  if (!user?.password_hash) throw { statusCode: 400, message: 'Aucun mot de passe défini' };
 
  const valid = await bcrypt.compare(old_password, user.password_hash);
  if (!valid) throw { statusCode: 400, message: 'Mot de passe actuel incorrect' };
 
  const hash = await bcrypt.hash(new_password, 10);
  await prisma.user.update({ where: { id: userId }, data: { password_hash: hash } });
  return { message: 'Mot de passe modifié' };
}

//Favoris
async function listFavorites(customerId) {
  const [items, flashSales] = await Promise.all([
    prisma.wishlist.findMany({
      where: { customer_id: customerId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        article: {
          select: {
            id: true, sku_code: true, name_fr: true, name_ar: true,
            price: true, vat_rate: true,
            category_id: true, brand_id: true,
            catalog_sku: { select: { id: true } },
            images: { select: { image_path: true }, take: 1 },
          },
        },
      },
    }),
    getActiveFlashSales(),
  ]);
  return items.map(w => {
    const a = w.article;
    const raw = a.images?.[0]?.image_path ?? null;
    const image_url = raw
      ? (raw.startsWith('http') ? raw : `${BASE_URL}${raw}`)
      : null;
    const ttc  = Math.round(Number(a.price) * (1 + Number(a.vat_rate) / 100) * 100) / 100;
    const deal = resolveArticleDiscount({
      articleSkuId: a.catalog_sku?.id ?? null,
      categoryId:   a.category_id ?? null,
      brandId:      a.brand_id ?? null,
      priceTtc:     ttc,
    }, flashSales);
    return {
      wishlist_id:   w.id,
      id:            a.id,
      sku_code:      a.sku_code,
      name_fr:       a.name_fr,
      name_ar:       a.name_ar,
      price_ttc:     deal ? deal.price_ttc : ttc,
      old_price_ttc: deal ? deal.old_price_ttc : null,
      discount_pct:  deal ? deal.discount_pct : null,
      sku_id:        a.catalog_sku?.id ?? null,
      image_url,
    };
  });
}

async function addFavorite(customerId, articleId) {
  const article = await prisma.article.findUnique({ where: { id: Number(articleId) } });
  if (!article) throw { statusCode: 404, message: 'Article introuvable' };
  await prisma.wishlist.upsert({
    where:  { customer_id_article_id: { customer_id: customerId, article_id: Number(articleId) } },
    update: {},
    create: { customer_id: customerId, article_id: Number(articleId) },
  });
  return { article_id: Number(articleId) };
}

async function removeFavorite(customerId, articleId) {
  await prisma.wishlist.deleteMany({
    where: { customer_id: customerId, article_id: Number(articleId) },
  });
}

// Photo de profile
async function uploadAvatar(customerId, filePath) {
  await prisma.customer.update({ where: { id: customerId }, data: { avatar_url: filePath } });
  return getProfile(customerId);
}

async function removeAvatar(customerId) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, is_deleted: false },
    select: { avatar_url: true },
  });
  if (customer?.avatar_url) {
    const abs = path.join(process.cwd(), customer.avatar_url.replace(/^\//, ''));
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  }
  await prisma.customer.update({ where: { id: customerId }, data: { avatar_url: null } });
  return getProfile(customerId);
}

module.exports = { getProfile, updateProfile, listAddresses, createAddress, updateAddress, setDefaultAddress, deleteAddress, listOrders, getOrderById, updateEmail, changePassword, requestPhoneChange, confirmPhoneChange, uploadAvatar, removeAvatar, listFavorites, addFavorite, removeFavorite };
