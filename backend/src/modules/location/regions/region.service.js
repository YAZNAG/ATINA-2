const repo = require('./region.repository');

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

  async create(data) {
    const exists = await repo.findByCode(data.code);
    if (exists) throw { statusCode: 409, message: 'Ce code région existe déjà' };
    return repo.create(data);
  }

  async update(id, data) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Région introuvable' };
    if (data.code) {
      const exists = await repo.findByCode(data.code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code région existe déjà' };
    }
    return repo.update(id, data);
  }

  async delete(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Région introuvable' };
    const provinceCount = await repo.countProvinces(id);
    if (provinceCount > 0) throw { statusCode: 400, message: 'Impossible de supprimer: région liée à des provinces' };
    const nodeCount = await repo.countNodes(id);
    if (nodeCount > 0) throw { statusCode: 400, message: 'Impossible de supprimer: région liée à des nodes' };
    await repo.softDelete(id);
  }
}

module.exports = new RegionService();
