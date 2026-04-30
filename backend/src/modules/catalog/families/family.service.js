const repo = require('./family.repository');

class FamilyService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getList() { return repo.findAll_noPage(); }

  async getById(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Famille introuvable' };
    return item;
  }

  async create(data) {
    const exists = await repo.findByCode(data.code);
    if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    return repo.create({
      ...data,
      sort_order: data.sort_order ? Number(data.sort_order) : 0,
    });
  }

  async update(id, data) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Famille introuvable' };
    if (data.code) {
      const exists = await repo.findByCode(data.code, Number(id));
      if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    }
    const updateData = { ...data };
    if (data.sort_order !== undefined) updateData.sort_order = Number(data.sort_order);
    return repo.update(Number(id), updateData);
  }

  async delete(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Famille introuvable' };
    const catCount = await repo.countCategories(Number(id));
    if (catCount > 0) throw { statusCode: 400, message: 'Impossible de supprimer : cette famille contient des catégories' };
    await repo.softDelete(Number(id));
  }
}

module.exports = new FamilyService();
