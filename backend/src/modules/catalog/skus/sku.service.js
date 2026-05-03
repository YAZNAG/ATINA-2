const repo = require('./sku.repository');

class SkuService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getList() {
    return repo.findAllFlat();
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'SKU introuvable' };
    return item;
  }

  async create() {
    return repo.create({});
  }

  async delete(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'SKU introuvable' };
    await repo.remove(id);
  }
}

module.exports = new SkuService();
