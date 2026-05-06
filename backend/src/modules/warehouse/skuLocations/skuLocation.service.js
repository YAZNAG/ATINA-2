const repo = require('./skuLocation.repository');
const locationRepo = require('../locations/location.repository');

const pick = (data) => {
  const out = {};
  const fields = ['sku_id', 'node_id', 'location_id', 'is_primary_location', 'is_active'];
  for (const k of fields) if (data[k] !== undefined) out[k] = data[k];
  if (out.is_primary_location !== undefined)
    out.is_primary_location = out.is_primary_location === true || out.is_primary_location === 'true';
  if (out.is_active !== undefined)
    out.is_active = out.is_active === true || out.is_active === 'true';
  return out;
};

class SkuLocationService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    if (params.all === 'true' || params.all === true) return { data };
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Affectation introuvable' };
    return item;
  }

  async create(data) {
    const payload = pick(data);
    if (!payload.sku_id) throw { statusCode: 400, message: 'SKU requis' };
    if (!payload.node_id) throw { statusCode: 400, message: 'Node requis' };
    if (!payload.location_id) throw { statusCode: 400, message: 'Emplacement requis' };

    const location = await locationRepo.findById(payload.location_id);
    if (!location) throw { statusCode: 404, message: 'Emplacement introuvable' };
    if (location.node_id !== payload.node_id)
      throw { statusCode: 400, message: "L'emplacement n'appartient pas au node sélectionné" };

    const dup = await repo.findDuplicate(payload.sku_id, payload.node_id, payload.location_id, null);
    if (dup) throw { statusCode: 409, message: 'Ce SKU est déjà affecté à cet emplacement dans ce node' };

    if (payload.is_primary_location) {
      await repo.clearPrimary(payload.sku_id, payload.node_id, null);
    }

    if (payload.is_primary_location === undefined) payload.is_primary_location = false;
    if (payload.is_active === undefined) payload.is_active = true;

    return repo.create(payload);
  }

  async update(id, data) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Affectation introuvable' };
    const payload = pick(data);

    const location_id = payload.location_id ?? item.location_id;
    const node_id = item.node_id;

    if (payload.location_id) {
      const location = await locationRepo.findById(location_id);
      if (!location) throw { statusCode: 404, message: 'Emplacement introuvable' };
      if (location.node_id !== node_id)
        throw { statusCode: 400, message: "L'emplacement n'appartient pas au node sélectionné" };

      const dup = await repo.findDuplicate(item.sku_id, node_id, location_id, id);
      if (dup) throw { statusCode: 409, message: 'Ce SKU est déjà affecté à cet emplacement dans ce node' };
    }

    if (payload.is_primary_location) {
      await repo.clearPrimary(item.sku_id, node_id, id);
    }

    return repo.update(id, payload);
  }

  async delete(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Affectation introuvable' };
    await repo.remove(id);
  }
}

module.exports = new SkuLocationService();
