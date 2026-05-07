const repo = require('./stock_status.repository');

const FIELDS = ['code', 'name_fr', 'name_ar', 'color', 'is_sellable', 'is_active', 'sort_order'];

const pick = (data) => {
  const out = {};
  for (const k of FIELDS) if (data[k] !== undefined) out[k] = data[k];
  if (out.is_sellable !== undefined) out.is_sellable = out.is_sellable === true || out.is_sellable === 'true';
  if (out.is_active   !== undefined) out.is_active   = out.is_active   === true || out.is_active   === 'true';
  if (out.sort_order  !== undefined) out.sort_order  = Number(out.sort_order) || 0;
  return out;
};

class StockStatusService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    if (params.all === 'true' || params.all === true) return { data };
    const page  = Number(params.page)  || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Statut de stock introuvable' };
    return item;
  }

  async create(data) {
    const payload = pick(data);
    if (!payload.code)    throw { statusCode: 400, message: 'Code requis' };
    if (!payload.name_fr) throw { statusCode: 400, message: 'Nom (FR) requis' };
    const exists = await repo.findByCode(payload.code);
    if (exists) throw { statusCode: 409, message: 'Ce code de statut existe déjà' };
    return repo.create(payload);
  }

  async update(id, data) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Statut de stock introuvable' };
    const payload = pick(data);
    if (payload.code) {
      const exists = await repo.findByCode(payload.code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code de statut existe déjà' };
    }
    return repo.update(id, payload);
  }

  async delete(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Statut de stock introuvable' };
    await repo.remove(id);
  }
}

module.exports = new StockStatusService();
