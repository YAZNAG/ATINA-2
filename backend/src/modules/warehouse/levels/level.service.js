const { audit } = require('../../../utils/audit');
const repo = require('./level.repository');

const FIELDS = ['code', 'name_fr', 'name_ar', 'sort_order', 'is_active'];

const pick = (data) => {
  const out = {};
  for (const k of FIELDS) if (data[k] !== undefined) out[k] = data[k];
  if (out.sort_order !== undefined) out.sort_order = Number(out.sort_order) || 0;
  if (out.is_active !== undefined) out.is_active = out.is_active === true || out.is_active === 'true';
  return out;
};

class LevelService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    if (params.all === 'true' || params.all === true) return { data };
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Niveau introuvable' };
    return item;
  }

  async create(data, req = null) {
    const payload = pick(data);
    if (!payload.code) throw { statusCode: 400, message: 'Code requis' };
    const exists = await repo.findByCode(payload.code);
    if (exists) throw { statusCode: 409, message: 'Ce code niveau existe déjà' };
    const created = await repo.create(payload);
    await audit(req, { action: 'CREATE', resource: 'levels', resource_id: created.id, new_values: payload });
    return created;
  }

  async update(id, data, req = null) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Niveau introuvable' };
    const payload = pick(data);
    if (payload.code) {
      const exists = await repo.findByCode(payload.code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code niveau existe déjà' };
    }
    const updated = await repo.update(id, payload);
    const old_values = {};
    Object.keys(payload).forEach((k) => { old_values[k] = item[k] ?? null; });
    await audit(req, { action: 'UPDATE', resource: 'levels', resource_id: id, old_values, new_values: payload });
    return updated;
  }

  async delete(id, req = null) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Niveau introuvable' };
    const used = await require('../../../config/database').warehouseLocation.count({ where: { level_id: id } });
    if (used > 0) throw { statusCode: 409, message: `Ce niveau est utilisé par ${used} emplacement(s)` };
    await repo.remove(id);
    await audit(req, { action: 'DELETE', resource: 'levels', resource_id: id, old_values: { code: item.code, name_fr: item.name_fr } });
  }
}

module.exports = new LevelService();
