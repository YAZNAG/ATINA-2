const bcrypt = require('bcryptjs');
const repo   = require('./driver.repository');
const prisma = require('../../../config/database');

const normPhone = (p) => String(p ?? '').replace(/\s+/g, '').replace(/^0/, '');

class DriverService {
  async list(params) {
    const page  = Math.max(1, parseInt(params.page || 1, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(params.limit || 25, 10) || 25));
    const { data, total } = await repo.findAll({ ...params, page, limit });
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const d = await repo.findById(id);
    if (!d || d.is_deleted) throw { statusCode: 404, message: 'Livreur introuvable' };
    delete d.password_hash;
    const av = await repo.findAvailability([id]);
    return repo.withAvailability(d, av[id]);
  }

  async _checkNode(node_id) {
    const node = await prisma.node.findFirst({ where: { id: node_id, is_active: true, is_deleted: false } });
    if (!node) throw { statusCode: 400, message: 'Node inactif ou introuvable' };
  }

  async create(body, created_by) {
    const { node_id, phone_country = '+212', phone_number, name, password, vehicle_type, vehicle_plate } = body;
    if (!node_id)      throw { statusCode: 400, message: 'Node requis' };
    if (!phone_number) throw { statusCode: 400, message: 'Téléphone requis' };
    if (!name?.trim()) throw { statusCode: 400, message: 'Nom requis' };
    if (!password || String(password).length < 6) throw { statusCode: 400, message: 'Mot de passe requis (min 6 caractères)' };

    await this._checkNode(node_id);

    const phone = normPhone(phone_number);
    const dup = await repo.findByPhone(phone_country, phone);
    if (dup) throw { statusCode: 409, message: 'Ce numéro est déjà utilisé' };

    const password_hash = await bcrypt.hash(password, 10);
    return repo.create({
      node_id, phone_country, phone_number: phone,
      name: name.trim(), password_hash,
      vehicle_type: vehicle_type?.trim() || null,
      vehicle_plate: vehicle_plate?.trim() || null,
      created_by: created_by ?? null,
    });
  }

  async update(id, body) {
    const driver = await repo.findById(id);
    if (!driver || driver.is_deleted) throw { statusCode: 404, message: 'Livreur introuvable' };
    const d = {};
    if (body.node_id       !== undefined && body.node_id !== driver.node_id) { await this._checkNode(body.node_id); d.node_id = body.node_id; }
    if (body.name          !== undefined) { if (!body.name?.trim()) throw { statusCode: 400, message: 'Nom invalide' }; d.name = body.name.trim(); }
    if (body.vehicle_type  !== undefined) d.vehicle_type  = body.vehicle_type?.trim() || null;
    if (body.vehicle_plate !== undefined) d.vehicle_plate = body.vehicle_plate?.trim() || null;
    if (body.phone_number !== undefined || body.phone_country !== undefined) {
      const phone_country = body.phone_country ?? driver.phone_country;
      const phone_number  = normPhone(body.phone_number ?? driver.phone_number);
      if (!phone_number) throw { statusCode: 400, message: 'Téléphone requis' };
      if (phone_country !== driver.phone_country || phone_number !== driver.phone_number) {
        const dup = await repo.findByPhone(phone_country, phone_number);
        if (dup && dup.id !== id) throw { statusCode: 409, message: 'Ce numéro est déjà utilisé' };
      }
      d.phone_country = phone_country;
      d.phone_number  = phone_number;
    }
    if (body.is_active     !== undefined) d.is_active     = body.is_active === true || body.is_active === 'true';
    const updated = await repo.update(id, d);
    const { password_hash, ...before } = driver;
    return { before, after: updated };
  }

  async activate(id) {
    const d = await repo.findById(id);
    if (!d || d.is_deleted) throw { statusCode: 404, message: 'Livreur introuvable' };
    return repo.update(id, { is_active: true });
  }

  // Un livreur inactif n'est plus assignable aux tournées (US-019).
  async deactivate(id) {
    const d = await repo.findById(id);
    if (!d || d.is_deleted) throw { statusCode: 404, message: 'Livreur introuvable' };
    const updated = await repo.update(id, { is_active: false });
    return { ...updated, open_tours: await repo.countOpenTours(id) };
  }

  async resetPassword(id, password) {
    if (!password || password.length < 6) throw { statusCode: 400, message: 'Mot de passe trop court (min 6 caractères)' };
    const d = await repo.findById(id);
    if (!d || d.is_deleted) throw { statusCode: 404, message: 'Livreur introuvable' };
    const password_hash = await bcrypt.hash(password, 10);
    await repo.update(id, { password_hash });
    return { id, message: 'Mot de passe réinitialisé' };
  }

  async delete(id) {
    const d = await repo.findById(id);
    if (!d || d.is_deleted) throw { statusCode: 404, message: 'Livreur introuvable' };
    return repo.softDelete(id);
  }

  async getStats(id, params = {}) {
    const d = await repo.findById(id);
    if (!d || d.is_deleted) throw { statusCode: 404, message: 'Livreur introuvable' };
    return repo.findStats(id, params);
  }

  async getTours(id, params = {}) {
    const d = await repo.findById(id);
    if (!d || d.is_deleted) throw { statusCode: 404, message: 'Livreur introuvable' };
    const page  = Math.max(1, parseInt(params.page || 1, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(params.limit || 20, 10) || 20));
    const { data, total } = await repo.findTours(id, { ...params, page, limit });
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }
}

module.exports = new DriverService();
