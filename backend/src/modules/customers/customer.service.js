const crypto = require('crypto');
const repo = require('./customer.repository');
const prisma = require('../../config/database');
const { audit } = require('../../utils/audit');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPORT_MAX = 20000;

/** Ville affichée : référentiel cities (city_id) quand il existe, sinon l'ancienne colonne texte. */
function withCityLabel(o) {
  if (!o || typeof o !== 'object') return o;
  return { ...o, city_label: o.city_ref?.name_fr ?? o.city ?? null };
}

async function resolveCityId(value) {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === '') return null;
  const id = String(value).trim();
  if (!UUID_RE.test(id)) throw { statusCode: 400, message: 'Ville invalide' };
  const city = await prisma.city.findUnique({ where: { id }, select: { id: true, is_deleted: true } });
  if (!city || city.is_deleted) throw { statusCode: 400, message: 'Ville introuvable dans le référentiel' };
  return city.id;
}

function parseDay(v, label, endOfDay = false) {
  if (!v) return null;
  const s = String(v).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(s);
  if (Number.isNaN(d.getTime())) throw { statusCode: 400, message: `${label} invalide` };
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(s)) d.setDate(d.getDate() + 1);
  return d;
}

function serializeCustomer(row) {
  if (!row) return row;
  const o = typeof row === 'object' && row !== null ? { ...row } : row;
  if (o.wallet_balance != null && typeof o.wallet_balance !== 'string') o.wallet_balance = String(o.wallet_balance);
  if (o.lat != null && typeof o.lat !== 'string') o.lat = String(o.lat);
  if (o.lng != null && typeof o.lng !== 'string') o.lng = String(o.lng);
  return withCityLabel(o);
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
  async list(rawQuery) {
    const query = await this.prepareQuery(rawQuery);
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

  async prepareQuery(rawQuery = {}) {
    const query = { ...rawQuery };
    if (query.city_id && UUID_RE.test(String(query.city_id))) {
      const c = await repo.findCityName(String(query.city_id));
      if (c) query._city_name_fr = c.name_fr;
    }
    return query;
  }

  /** Export de la liste filtrée (même périmètre que la liste, plafonné). */
  async exportList(rawQuery) {
    const query = await this.prepareQuery(rawQuery);
    const items = await repo.findAllForExport(query, EXPORT_MAX);
    return { items: serializeList(items), truncated: items.length >= EXPORT_MAX, max: EXPORT_MAX };
  }

  /** Commandes du client (US-105) : triées par date décroissante, filtres statut / période. */
  async orders(id, query = {}) {
    const customer = await prisma.customer.findUnique({ where: { id }, select: { id: true } });
    if (!customer) throw { statusCode: 404, message: 'Client introuvable' };
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 25));
    const where = { customer_id: id, is_deleted: false };
    if (query.status) where.status = { code: String(query.status) };
    const from = parseDay(query.date_from, 'Date de début');
    const to = parseDay(query.date_to, 'Date de fin', true);
    if (from || to) where.created_at = { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) };

    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          created_at: true,
          total_ttc: true,
          cod_amount: true,
          points_earned: true,
          slot_start: true,
          slot_end: true,
          status: { select: { code: true, name_fr: true } },
          node: { select: { id: true, code: true, name_fr: true } },
          delivery_type: { select: { code: true, name_fr: true } },
          confirmed_slot: { select: { id: true, specific_date: true, slot_start: true, slot_end: true } },
          payments: {
            select: { payment_method: { select: { code: true, name_fr: true } }, status: { select: { code: true, name_fr: true } } },
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    const items = rows.map((o) => ({
      ...o,
      total_ttc: String(o.total_ttc),
      cod_amount: o.cod_amount != null ? String(o.cod_amount) : null,
      payment_method: o.payments?.[0]?.payment_method ?? null,
      payment_status: o.payments?.[0]?.status ?? null,
      payments: undefined,
    }));
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async getById(id) {
    const row = await repo.findByIdWithIncludes(id);
    if (!row) throw { statusCode: 404, message: 'Client introuvable' };
    return serializeCustomer(row);
  }

  async create(body, req = null) {
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
    const city_id = await resolveCityId(body.city_id);

    const created = await repo.create({
      phone_country,
      phone_number,
      name,
      preferred_lang,
      city,
      ...(city_id !== undefined ? { city_id } : {}),
      referred_by_id,
      referral_code,
      wallet_balance: 0,
      points_balance: 0,
      points_lifetime: 0,
      is_active: true,
      is_deleted: false,
    });
    await audit(req, {
      action: 'CREATE', resource: 'customers', resource_id: created.id,
      new_values: { name, phone_country, phone_number, preferred_lang, city, city_id: city_id ?? null, referred_by_id },
    });

    return serializeCustomer(created);
  }

  async update(id, body, req = null) {
    const existing = await repo.findByIdWithIncludes(id);
    if (!existing) throw { statusCode: 404, message: 'Client introuvable' };
    if (existing.is_deleted) throw { statusCode: 400, message: 'Client supprimé — modification impossible' };

    const data = {};
    if (body.name !== undefined) data.name = String(body.name || '').trim();
    if (body.preferred_lang !== undefined) data.preferred_lang = body.preferred_lang === 'ar' ? 'ar' : 'fr';
    if (body.city !== undefined) data.city = body.city == null || String(body.city).trim() === '' ? null : String(body.city).trim();
    if (body.city_id !== undefined) data.city_id = await resolveCityId(body.city_id);
    if (body.lat !== undefined) {
      if (body.lat === null || body.lat === '') data.lat = null;
      else data.lat = body.lat;
    }
    if (body.lng !== undefined) {
      if (body.lng === null || body.lng === '') data.lng = null;
      else data.lng = body.lng;
    }
    if (body.is_active !== undefined) {
      // Le statut ne change QUE via Bloquer / Débloquer (motif obligatoire tracé dans audit_logs — WF#7).
      const wanted = body.is_active === true || body.is_active === 'true';
      if (wanted !== existing.is_active) {
        throw {
          statusCode: 400,
          message: 'Le statut du client se modifie uniquement via les actions Bloquer / Débloquer (motif obligatoire).',
        };
      }
    }

    if (data.name === '') throw { statusCode: 400, message: 'Nom invalide' };
    if (Object.keys(data).length === 0) throw { statusCode: 400, message: 'Aucun champ à mettre à jour' };

    const updated = await repo.updateById(id, data);
    const old_values = {};
    Object.keys(data).forEach((k) => { old_values[k] = existing[k] ?? null; });
    await audit(req, { action: 'UPDATE', resource: 'customers', resource_id: id, old_values, new_values: data });
    return serializeCustomer(updated);
  }

  /**
   * Blocage (WF#7 / US-012) : motif OBLIGATOIRE, conservé dans audit_logs
   * (action BLOCK_USER) — seule trace du blocage. Non rétroactif : commandes,
   * points et parrainages ne sont pas modifiés.
   */
  async block(req, id, body = {}) {
    const reason = String(body.reason ?? body.motif ?? '').trim();
    if (!reason) throw { statusCode: 400, message: 'Le motif du blocage est obligatoire (fraude, litige, abus…).' };
    if (reason.length > 500) throw { statusCode: 400, message: 'Le motif ne peut pas dépasser 500 caractères.' };
    const existing = await repo.findByIdWithIncludes(id);
    if (!existing) throw { statusCode: 404, message: 'Client introuvable' };
    if (existing.is_deleted) throw { statusCode: 400, message: 'Client supprimé' };
    if (!existing.is_active) throw { statusCode: 400, message: 'Ce client est déjà bloqué.' };

    const result = await prisma.$transaction(async (tx) => {
      const upd = await tx.customer.update({ where: { id }, data: { is_active: false }, select: repo.LIST_SELECT });
      if (existing.user_id) {
        await tx.user.update({ where: { id: existing.user_id }, data: { is_active: false } });
      }
      await audit(req, {
        action: 'BLOCK_USER',
        resource: 'customers',
        resource_id: id,
        old_values: { is_active: true },
        new_values: { is_active: false, reason },
      }, tx);
      return upd;
    });
    return serializeCustomer(result);
  }

  /** Déblocage (WF#7 B) : motif recommandé ; nouvelle ligne audit_logs UNBLOCK_USER. */
  async unblock(req, id, body = {}) {
    const reason = String(body.reason ?? body.motif ?? '').trim() || null;
    if (reason && reason.length > 500) throw { statusCode: 400, message: 'Le motif ne peut pas dépasser 500 caractères.' };
    const existing = await repo.findByIdWithIncludes(id);
    if (!existing) throw { statusCode: 404, message: 'Client introuvable' };
    if (existing.is_deleted) throw { statusCode: 400, message: 'Client supprimé' };
    if (existing.is_active) throw { statusCode: 400, message: 'Ce client n’est pas bloqué.' };

    const result = await prisma.$transaction(async (tx) => {
      const upd = await tx.customer.update({ where: { id }, data: { is_active: true }, select: repo.LIST_SELECT });
      if (existing.user_id) {
        await tx.user.update({ where: { id: existing.user_id }, data: { is_active: true } });
      }
      await audit(req, {
        action: 'UNBLOCK_USER',
        resource: 'customers',
        resource_id: id,
        old_values: { is_active: false },
        new_values: { is_active: true, reason },
      }, tx);
      return upd;
    });
    return serializeCustomer(result);
  }

  /** Historique des blocages / déblocages (audit_logs, lecture). */
  async blockHistory(id) {
    const rows = await prisma.auditLog.findMany({
      where: { resource: 'customers', resource_id: id, action: { in: ['BLOCK_USER', 'UNBLOCK_USER'] } },
      orderBy: { created_at: 'desc' },
      take: 50,
      select: { id: true, action: true, new_values: true, created_at: true, user: { select: { id: true, full_name: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      reason: r.new_values?.reason ?? null,
      created_at: r.created_at,
      admin: r.user?.full_name ?? null,
    }));
  }

  async softDelete(id, req = null) {
    const existing = await repo.findByIdWithIncludes(id);
    if (!existing) throw { statusCode: 404, message: 'Client introuvable' };
    if (existing.is_deleted) throw { statusCode: 400, message: 'Déjà supprimé' };
    await repo.softDelete(id);
    await audit(req, {
      action: 'DELETE', resource: 'customers', resource_id: id,
      old_values: { is_deleted: false, name: existing.name, phone_number: existing.phone_number },
      new_values: { is_deleted: true },
    });
    return { id };
  }
}

module.exports = new CustomerService();
