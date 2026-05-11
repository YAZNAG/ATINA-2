const bcrypt = require('bcryptjs');
const repo   = require('./picker.repository');
const prisma = require('../../../config/database');

class PickerService {
  async list(params) {
    const page  = Math.max(1, parseInt(params.page || 1));
    const limit = Math.min(100, parseInt(params.limit || 25));
    const { data, total } = await repo.findAll({ ...params, page, limit });
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const p = await repo.findById(id);
    if (!p || p.is_deleted) throw { statusCode: 404, message: 'Picker introuvable' };
    delete p.password_hash;
    return p;
  }

  async create(body, created_by) {
    const { node_id, phone_country = '+212', phone_number, name, password } = body;
    if (!node_id)      throw { statusCode: 400, message: 'node_id requis' };
    if (!phone_number) throw { statusCode: 400, message: 'phone_number requis' };
    if (!name?.trim()) throw { statusCode: 400, message: 'name requis' };
    if (!password)     throw { statusCode: 400, message: 'password requis' };

    const node = await prisma.node.findFirst({ where: { id: node_id, is_active: true, is_deleted: false } });
    if (!node) throw { statusCode: 400, message: 'Node inactif ou introuvable' };

    const dup = await repo.findByPhone(phone_country, phone_number.replace(/^0/, ''));
    if (dup) throw { statusCode: 409, message: 'Ce numéro est déjà utilisé' };

    const password_hash = await bcrypt.hash(password, 10);
    return repo.create({ node_id, phone_country, phone_number: phone_number.replace(/^0/, ''), name: name.trim(), password_hash, created_by: created_by ?? null });
  }

  async update(id, body) {
    const picker = await repo.findById(id);
    if (!picker || picker.is_deleted) throw { statusCode: 404, message: 'Picker introuvable' };
    const d = {};
    if (body.node_id  !== undefined) d.node_id  = body.node_id;
    if (body.name     !== undefined) { if (!body.name?.trim()) throw { statusCode: 400, message: 'name invalide' }; d.name = body.name.trim(); }
    if (body.is_active !== undefined) d.is_active = body.is_active === true || body.is_active === 'true';
    return repo.update(id, d);
  }

  async activate(id)   { const p = await repo.findById(id); if (!p) throw { statusCode: 404, message: 'Picker introuvable' }; return repo.update(id, { is_active: true }); }
  async deactivate(id) { const p = await repo.findById(id); if (!p) throw { statusCode: 404, message: 'Picker introuvable' }; return repo.update(id, { is_active: false }); }

  async resetPassword(id, password) {
    if (!password || password.length < 6) throw { statusCode: 400, message: 'Mot de passe trop court (min 6 caractères)' };
    const p = await repo.findById(id);
    if (!p) throw { statusCode: 404, message: 'Picker introuvable' };
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
    const page = Math.max(1, parseInt(params.page || 1));
    const limit = Math.min(100, parseInt(params.limit || 25));
    const { data, total } = await repo.findSessions(id, { ...params, page, limit });
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getOrders(id, params) {
    const p = await repo.findById(id);
    if (!p || p.is_deleted) throw { statusCode: 404, message: 'Picker introuvable' };
    const page = Math.max(1, parseInt(params.page || 1));
    const limit = Math.min(50, parseInt(params.limit || 20));
    const { data, total } = await repo.findOrders(id, { ...params, page, limit });
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }
}

module.exports = new PickerService();
