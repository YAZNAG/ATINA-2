const repo = require('./inventory_gap_type.repository');

const FIELDS = ['code', 'name_fr', 'name_ar', 'description_fr', 'color', 'impact_stock', 'requires_validation', 'is_active', 'sort_order'];

const pick = (data) => {
  const out = {};
  for (const k of FIELDS) if (data[k] !== undefined) out[k] = data[k];
  if (out.requires_validation !== undefined) out.requires_validation = out.requires_validation === true || out.requires_validation === 'true';
  if (out.is_active           !== undefined) out.is_active           = out.is_active           === true || out.is_active           === 'true';
  if (out.sort_order          !== undefined) out.sort_order          = Number(out.sort_order) || 0;
  return out;
};

class InventoryGapTypeService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    if (params.all === 'true' || params.all === true) return { data };
    const page  = Number(params.page)  || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: "Type d'écart introuvable" };
    return item;
  }

  async create(data) {
    const payload = pick(data);
    if (!payload.code)         throw { statusCode: 400, message: 'Code requis' };
    if (!payload.name_fr)      throw { statusCode: 400, message: 'Nom (FR) requis' };
    if (!payload.impact_stock) throw { statusCode: 400, message: 'Impact stock requis' };
    if (!repo.ALLOWED_IMPACTS.includes(payload.impact_stock))
      throw { statusCode: 400, message: `Impact invalide — valeurs : ${repo.ALLOWED_IMPACTS.join(', ')}` };
    const exists = await repo.findByCode(payload.code);
    if (exists) throw { statusCode: 409, message: "Ce code de type d'écart existe déjà" };
    return repo.create(payload);
  }

  async update(id, data) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: "Type d'écart introuvable" };
    const payload = pick(data);
    if (payload.impact_stock && !repo.ALLOWED_IMPACTS.includes(payload.impact_stock))
      throw { statusCode: 400, message: `Impact invalide — valeurs : ${repo.ALLOWED_IMPACTS.join(', ')}` };
    if (payload.code) {
      const exists = await repo.findByCode(payload.code, id);
      if (exists) throw { statusCode: 409, message: "Ce code de type d'écart existe déjà" };
    }
    return repo.update(id, payload);
  }

  async delete(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: "Type d'écart introuvable" };
    await repo.remove(id);
  }
}

module.exports = new InventoryGapTypeService();
