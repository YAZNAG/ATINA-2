const repo = require('./region.repository');

const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

const pickRegionPayload = (body, mode = 'create') => {
  const out = {
    code: body.code,
    name_fr: body.name_fr,
    name_ar: body.name_ar,
    description_fr: emptyToNull(body.description_fr),
    description_ar: emptyToNull(body.description_ar),
    is_active:
      mode === 'create' && body.is_active === undefined ? true : Boolean(body.is_active),
  };
  return out;
};

class RegionService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Région introuvable' };
    return item;
  }

  async create(body, userId) {
    const data = pickRegionPayload(body, 'create');
    const exists = await repo.findByCode(data.code);
    if (exists) throw { statusCode: 409, message: 'Ce code région existe déjà' };
    return repo.create({ ...data, created_by: userId });
  }

  async update(id, body, userId) {
    const data = pickRegionPayload(body, 'update');
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Région introuvable' };
    if (data.code) {
      const exists = await repo.findByCode(data.code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code région existe déjà' };
    }
    return repo.update(id, { ...data, updated_by: userId });
  }

  async delete(id, userId) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Région introuvable' };
    const provinceCount = await repo.countProvinces(id);
    if (provinceCount > 0) throw { statusCode: 400, message: 'Impossible de supprimer: région liée à des provinces' };
    const nodeCount = await repo.countNodes(id);
    if (nodeCount > 0) throw { statusCode: 400, message: 'Impossible de supprimer: région liée à des nodes' };
    await repo.softDelete(id, userId);
  }
}

module.exports = new RegionService();
