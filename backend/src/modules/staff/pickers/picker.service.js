const bcrypt = require('bcryptjs');
const repo   = require('./picker.repository');
const prisma = require('../../../config/database');
const pickingRepo    = require('../../picking/picking.repository');
const pickingService = require('../../picking/picking.service');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normPhone = (p) => String(p ?? '').replace(/\s+/g, '').replace(/^0/, '');

class PickerService {
  async list(params) {
    const page  = Math.max(1, parseInt(params.page || 1, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(params.limit || 25, 10) || 25));
    const { data, total } = await repo.findAll({ ...params, page, limit });
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const p = await repo.findById(id);
    if (!p || p.is_deleted) throw { statusCode: 404, message: 'Picker introuvable' };
    delete p.password_hash;
    p.active_sessions = await repo.countActiveSessions(id);
    return p;
  }

  async _checkNode(node_id) {
    const node = await prisma.node.findFirst({ where: { id: node_id, is_active: true, is_deleted: false } });
    if (!node) throw { statusCode: 400, message: 'Node inactif ou introuvable' };
  }

  async create(body, created_by) {
    const { node_id, phone_country = '+212', phone_number, name, password, email } = body;
    if (!node_id)      throw { statusCode: 400, message: 'Node requis' };
    if (!phone_number) throw { statusCode: 400, message: 'Téléphone requis' };
    if (!name?.trim()) throw { statusCode: 400, message: 'Nom requis' };
    if (!password || String(password).length < 6) throw { statusCode: 400, message: 'Mot de passe requis (min 6 caractères)' };
    if (email && !EMAIL_RE.test(String(email).trim())) throw { statusCode: 400, message: 'Email invalide' };

    await this._checkNode(node_id);

    const phone = normPhone(phone_number);
    const dup = await repo.findByPhone(phone_country, phone);
    if (dup) throw { statusCode: 409, message: 'Ce numéro est déjà utilisé' };

    const password_hash = await bcrypt.hash(password, 10);
    return repo.create({
      node_id, phone_country, phone_number: phone, name: name.trim(), password_hash,
      email: email?.trim() || null,
      created_by: created_by ?? null,
    });
  }

  async update(id, body) {
    const picker = await repo.findById(id);
    if (!picker || picker.is_deleted) throw { statusCode: 404, message: 'Picker introuvable' };
    const d = {};
    if (body.node_id !== undefined && body.node_id !== picker.node_id) { await this._checkNode(body.node_id); d.node_id = body.node_id; }
    if (body.name    !== undefined) { if (!body.name?.trim()) throw { statusCode: 400, message: 'Nom invalide' }; d.name = body.name.trim(); }
    if (body.email   !== undefined) {
      const e = body.email?.trim() || null;
      if (e && !EMAIL_RE.test(e)) throw { statusCode: 400, message: 'Email invalide' };
      d.email = e;
    }
    if (body.phone_number !== undefined || body.phone_country !== undefined) {
      const phone_country = body.phone_country ?? picker.phone_country;
      const phone_number  = normPhone(body.phone_number ?? picker.phone_number);
      if (!phone_number) throw { statusCode: 400, message: 'Téléphone requis' };
      if (phone_country !== picker.phone_country || phone_number !== picker.phone_number) {
        const dup = await repo.findByPhone(phone_country, phone_number);
        if (dup && dup.id !== id) throw { statusCode: 409, message: 'Ce numéro est déjà utilisé' };
      }
      d.phone_country = phone_country;
      d.phone_number  = phone_number;
    }
    if (body.is_active !== undefined) d.is_active = body.is_active === true || body.is_active === 'true';
    const updated = await repo.update(id, d);
    return { before: this._public(picker), after: updated };
  }

  _public(p) {
    if (!p) return p;
    const { password_hash, ...rest } = p;
    return rest;
  }

  async activate(id) {
    const p = await repo.findById(id);
    if (!p || p.is_deleted) throw { statusCode: 404, message: 'Picker introuvable' };
    return repo.update(id, { is_active: true });
  }

  // Un picker inactif n'est plus assignable (US-017) ; ses sessions en cours restent à réassigner.
  async deactivate(id) {
    const p = await repo.findById(id);
    if (!p || p.is_deleted) throw { statusCode: 404, message: 'Picker introuvable' };
    const updated = await repo.update(id, { is_active: false });
    return { ...updated, active_sessions: await repo.countActiveSessions(id) };
  }

  async resetPassword(id, password) {
    if (!password || password.length < 6) throw { statusCode: 400, message: 'Mot de passe trop court (min 6 caractères)' };
    const p = await repo.findById(id);
    if (!p || p.is_deleted) throw { statusCode: 404, message: 'Picker introuvable' };
    const password_hash = await bcrypt.hash(password, 10);
    await repo.update(id, { password_hash });
    return { id, message: 'Mot de passe réinitialisé' };
  }

  async delete(id) {
    const p = await repo.findById(id);
    if (!p || p.is_deleted) throw { statusCode: 404, message: 'Picker introuvable' };
    return repo.softDelete(id);
  }

  async getStats(id, params) {
    const p = await repo.findById(id);
    if (!p || p.is_deleted) throw { statusCode: 404, message: 'Picker introuvable' };
    return repo.findStats(id, params);
  }

  async getSessions(id, params) {
    const p = await repo.findById(id);
    if (!p || p.is_deleted) throw { statusCode: 404, message: 'Picker introuvable' };
    const page = Math.max(1, parseInt(params.page || 1, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(params.limit || 25, 10) || 25));
    const { data, total } = await repo.findSessions(id, { ...params, page, limit });
    // Performance par session : durée, progression, taux de prélèvement, articles/min
    const agg = await pickingRepo.aggregateItems(data.map((s) => s.id));
    return { data: data.map((s) => pickingService._enrich(s, agg)), pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getOrders(id, params) {
    const p = await repo.findById(id);
    if (!p || p.is_deleted) throw { statusCode: 404, message: 'Picker introuvable' };
    const page = Math.max(1, parseInt(params.page || 1, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(params.limit || 20, 10) || 20));
    const { data, total } = await repo.findOrders(id, { ...params, page, limit });
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }
}

module.exports = new PickerService();
