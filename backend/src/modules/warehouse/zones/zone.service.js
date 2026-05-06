const repo = require('./zone.repository');

const FIELDS = ['code', 'name_fr', 'name_ar', 'description_fr', 'description_ar', 'is_active'];

const pick = (data) => {
  const out = {};
  for (const k of FIELDS) if (data[k] !== undefined) out[k] = data[k];
  if (out.is_active !== undefined) out.is_active = out.is_active === true || out.is_active === 'true';
  return out;
};

class ZoneService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    if (params.all === 'true' || params.all === true) return { data };
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Zone introuvable' };
    return item;
  }

  async create(data) {
    const payload = pick(data);
    if (!payload.code) throw { statusCode: 400, message: 'Code requis' };
    const exists = await repo.findByCode(payload.code);
    if (exists) throw { statusCode: 409, message: 'Ce code zone existe déjà' };
    return repo.create(payload);
  }

  async update(id, data) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Zone introuvable' };
    const payload = pick(data);
    if (payload.code) {
      const exists = await repo.findByCode(payload.code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code zone existe déjà' };
    }
    return repo.update(id, payload);
  }

  async delete(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Zone introuvable' };
    const used = await require('../../../config/database').warehouseLocation.count({ where: { zone_id: id } });
    if (used > 0) throw { statusCode: 409, message: `Cette zone est utilisée par ${used} emplacement(s)` };
    await repo.remove(id);
  }
}

module.exports = new ZoneService();
