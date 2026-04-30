const repo = require('./category.repository');

class CategoryService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getList(family_id) { return repo.findAll_noPage(family_id); }

  async getById(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Catégorie introuvable' };
    return item;
  }

  async create(data) {
    const exists = await repo.findByCode(data.code);
    if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    return repo.create({
      ...data,
      family_id: Number(data.family_id),
      sort_order: data.sort_order ? Number(data.sort_order) : 0,
    });
  }

  async update(id, data) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Catégorie introuvable' };
    if (data.code) {
      const exists = await repo.findByCode(data.code, Number(id));
      if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    }
    const updateData = { ...data };
    if (data.family_id) updateData.family_id = Number(data.family_id);
    if (data.sort_order !== undefined) updateData.sort_order = Number(data.sort_order);
    return repo.update(Number(id), updateData);
  }

  async delete(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Catégorie introuvable' };
    const subCount = await repo.countSubCategories(Number(id));
    if (subCount > 0) throw { statusCode: 400, message: 'Impossible de supprimer : cette catégorie contient des sous-catégories' };
    await repo.softDelete(Number(id));
  }
}

module.exports = new CategoryService();
