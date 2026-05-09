const crypto = require('crypto');
const repo = require('./customer.repository');

function serializeCustomer(row) {
  if (!row) return row;
  const o = typeof row === 'object' && row !== null ? { ...row } : row;
  if (o.wallet_balance != null && typeof o.wallet_balance !== 'string') o.wallet_balance = String(o.wallet_balance);
  if (o.lat != null && typeof o.lat !== 'string') o.lat = String(o.lat);
  if (o.lng != null && typeof o.lng !== 'string') o.lng = String(o.lng);
  return o;
}

function serializeList(items) {
  return (items || []).map(serializeCustomer);
}

async function generateUniqueReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 30; attempt += 1) {
    let code = '';
    const bytes = crypto.randomBytes(12);
    for (let i = 0; i < 10; i += 1) code += chars[bytes[i] % chars.length];
    const exists = await repo.findByReferralCode(code);
    if (!exists) return code;
  }
  throw { statusCode: 500, message: 'Impossible de générer un code parrainage unique' };
}

class CustomerService {
  async list(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 25));
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      repo.findManyForList(query, { skip, take: limit }),
      repo.countForList(query),
    ]);
    return {
      items: serializeList(items),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async getById(id) {
    const row = await repo.findByIdWithIncludes(id);
    if (!row) throw { statusCode: 404, message: 'Client introuvable' };
    return serializeCustomer(row);
  }

  async create(body) {
    const phone_country = (body.phone_country && String(body.phone_country).trim()) || '+212';
    const phone_number = String(body.phone_number || '').trim();
    const name = String(body.name || '').trim();
    const preferred_lang = body.preferred_lang === 'ar' ? 'ar' : 'fr';
    const city = body.city != null && String(body.city).trim() !== '' ? String(body.city).trim() : null;
    const referred_by_id = body.referred_by_id && String(body.referred_by_id).trim() !== '' ? String(body.referred_by_id).trim() : null;

    if (!phone_number) throw { statusCode: 400, message: 'Numéro de téléphone requis' };
    if (!name) throw { statusCode: 400, message: 'Nom requis' };

    const dup = await repo.findActiveByPhone(phone_country, phone_number, null);
    if (dup) throw { statusCode: 409, message: 'Ce numéro est déjà utilisé par un client actif' };

    if (referred_by_id) {
      const ref = await repo.existsById(referred_by_id);
      if (!ref) throw { statusCode: 400, message: 'Parrain introuvable ou supprimé' };
    }

    const referral_code = await generateUniqueReferralCode();

    const created = await repo.create({
      phone_country,
      phone_number,
      name,
      preferred_lang,
      city,
      referred_by_id,
      referral_code,
      wallet_balance: 0,
      points_balance: 0,
      points_lifetime: 0,
      is_active: true,
      is_deleted: false,
    });

    return serializeCustomer(created);
  }

  async update(id, body) {
    const existing = await repo.findByIdWithIncludes(id);
    if (!existing) throw { statusCode: 404, message: 'Client introuvable' };
    if (existing.is_deleted) throw { statusCode: 400, message: 'Client supprimé — modification impossible' };

    const data = {};
    if (body.name !== undefined) data.name = String(body.name || '').trim();
    if (body.preferred_lang !== undefined) data.preferred_lang = body.preferred_lang === 'ar' ? 'ar' : 'fr';
    if (body.city !== undefined) data.city = body.city == null || String(body.city).trim() === '' ? null : String(body.city).trim();
    if (body.lat !== undefined) {
      if (body.lat === null || body.lat === '') data.lat = null;
      else data.lat = body.lat;
    }
    if (body.lng !== undefined) {
      if (body.lng === null || body.lng === '') data.lng = null;
      else data.lng = body.lng;
    }
    if (body.is_active !== undefined) data.is_active = body.is_active === true || body.is_active === 'true';

    if (data.name === '') throw { statusCode: 400, message: 'Nom invalide' };
    if (Object.keys(data).length === 0) throw { statusCode: 400, message: 'Aucun champ à mettre à jour' };

    const updated = await repo.updateById(id, data);
    return serializeCustomer(updated);
  }

  async block(id) {
    const existing = await repo.findByIdWithIncludes(id);
    if (!existing) throw { statusCode: 404, message: 'Client introuvable' };
    if (existing.is_deleted) throw { statusCode: 400, message: 'Client supprimé' };
    return serializeCustomer(await repo.updateById(id, { is_active: false }));
  }

  async unblock(id) {
    const existing = await repo.findByIdWithIncludes(id);
    if (!existing) throw { statusCode: 404, message: 'Client introuvable' };
    if (existing.is_deleted) throw { statusCode: 400, message: 'Client supprimé' };
    return serializeCustomer(await repo.updateById(id, { is_active: true }));
  }

  async softDelete(id) {
    const existing = await repo.findByIdWithIncludes(id);
    if (!existing) throw { statusCode: 404, message: 'Client introuvable' };
    if (existing.is_deleted) throw { statusCode: 400, message: 'Déjà supprimé' };
    await repo.softDelete(id);
    return { id };
  }
}

module.exports = new CustomerService();
