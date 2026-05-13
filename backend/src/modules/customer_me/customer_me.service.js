const prisma = require('../../config/database');

// ── Profile ───────────────────────────────────────────────────────────────────
async function getProfile(customerId) {
  const customer = await prisma.customer.findFirst({
    where:  { id: customerId, is_deleted: false },
    select: {
      id: true, name: true, phone_country: true, phone_number: true,
      preferred_lang: true, city: true, lat: true, lng: true,
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

// ── Addresses ─────────────────────────────────────────────────────────────────
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
  if (body.label          !== undefined) data.label         = trunc(body.label, 100);
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

module.exports = { getProfile, updateProfile, listAddresses, createAddress, updateAddress, setDefaultAddress, deleteAddress };
