const { audit } = require('../../../utils/audit');
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

  async create(data, req = null) {
    const payload = pick(data);
    if (!payload.code) throw { statusCode: 400, message: 'Code requis' };
    const exists = await repo.findByCode(payload.code);
    if (exists) throw { statusCode: 409, message: 'Ce code zone existe déjà' };
    const created = await repo.create(payload);
    await audit(req, { action: 'CREATE', resource: 'zones', resource_id: created.id, new_values: payload });
    return created;
  }

  async update(id, data, req = null) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Zone introuvable' };
    const payload = pick(data);
    if (payload.code) {
      const exists = await repo.findByCode(payload.code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code zone existe déjà' };
    }
    const updated = await repo.update(id, payload);
    const old_values = {};
    Object.keys(payload).forEach((k) => { old_values[k] = item[k] ?? null; });
    await audit(req, { action: 'UPDATE', resource: 'zones', resource_id: id, old_values, new_values: payload });
    return updated;
  }

  async delete(id, req = null) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Zone introuvable' };
    const used = await require('../../../config/database').warehouseLocation.count({ where: { zone_id: id } });
    if (used > 0) throw { statusCode: 409, message: `Cette zone est utilisée par ${used} emplacement(s)` };
    await repo.remove(id);
    await audit(req, { action: 'DELETE', resource: 'zones', resource_id: id, old_values: { code: item.code, name_fr: item.name_fr } });
  }
}

module.exports = new ZoneService();
