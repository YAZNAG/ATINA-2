const repo = require('./articleStatus.repository');

class ArticleStatusService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }
  async getList() { return repo.findAll_noPage(); }
  async getById(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: "Statut article introuvable" };
    return item;
  }
  async create(data) {
    const exists = await repo.findByCode(data.code);
    if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    return repo.create(data);
  }
  async update(id, data) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: "Statut article introuvable" };
    if (data.code) {
      const exists = await repo.findByCode(data.code, Number(id));
      if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    }
    return repo.update(Number(id), data);
  }
  async delete(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: "Statut article introuvable" };
    await repo.remove(Number(id));
  }
}

module.exports = new ArticleStatusService();
