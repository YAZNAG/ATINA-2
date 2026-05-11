const bcrypt = require('bcryptjs');
const repo   = require('./driver.repository');
const prisma = require('../../../config/database');

class DriverService {
  async list(params) {
    const page  = Math.max(1, parseInt(params.page || 1));
    const limit = Math.min(100, parseInt(params.limit || 25));
    const { data, total } = await repo.findAll({ ...params, page, limit });
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const d = await repo.findById(id);
    if (!d || d.is_deleted) throw { statusCode: 404, message: 'Livreur introuvable' };
    delete d.password_hash;
    return d;
  }

  async create(body, created_by) {
    const { node_id, phone_country = '+212', phone_number, name, password, vehicle_type, vehicle_plate } = body;
    if (!node_id)      throw { statusCode: 400, message: 'node_id requis' };
    if (!phone_number) throw { statusCode: 400, message: 'phone_number requis' };
    if (!name?.trim()) throw { statusCode: 400, message: 'name requis' };
    if (!password)     throw { statusCode: 400, message: 'password requis' };

    const node = await prisma.node.findFirst({ where: { id: node_id, is_active: true, is_deleted: false } });
    if (!node) throw { statusCode: 400, message: 'Node inactif ou introuvable' };

    const dup = await repo.findByPhone(phone_country, phone_number.replace(/^0/, ''));
    if (dup) throw { statusCode: 409, message: 'Ce numéro est déjà utilisé' };

    const password_hash = await bcrypt.hash(password, 10);
    return repo.create({
      node_id, phone_country, phone_number: phone_number.replace(/^0/, ''),
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
    if (body.node_id       !== undefined) d.node_id       = body.node_id;
    if (body.name          !== undefined) { if (!body.name?.trim()) throw { statusCode: 400, message: 'name invalide' }; d.name = body.name.trim(); }
    if (body.vehicle_type  !== undefined) d.vehicle_type  = body.vehicle_type?.trim() || null;
    if (body.vehicle_plate !== undefined) d.vehicle_plate = body.vehicle_plate?.trim() || null;
    if (body.is_active     !== undefined) d.is_active     = body.is_active === true || body.is_active === 'true';
    return repo.update(id, d);
  }

  async activate(id)   { const d = await repo.findById(id); if (!d) throw { statusCode: 404, message: 'Livreur introuvable' }; return repo.update(id, { is_active: true }); }
  async deactivate(id) { const d = await repo.findById(id); if (!d) throw { statusCode: 404, message: 'Livreur introuvable' }; return repo.update(id, { is_active: false }); }

  async resetPassword(id, password) {
    if (!password || password.length < 6) throw { statusCode: 400, message: 'Mot de passe trop court (min 6 caractères)' };
    const d = await repo.findById(id);
    if (!d) throw { statusCode: 404, message: 'Livreur introuvable' };
    const password_hash = await bcrypt.hash(password, 10);
    await repo.update(id, { password_hash });
    return { id, message: 'Mot de passe réinitialisé' };
  }

  async delete(id) {
    const d = await repo.findById(id);
    if (!d || d.is_deleted) throw { statusCode: 404, message: 'Livreur introuvable' };
    return repo.softDelete(id);
  }
}

module.exports = new DriverService();
