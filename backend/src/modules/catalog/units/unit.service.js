const repo = require('./unit.repository');

class UnitService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getList() {
    return repo.findAll_noPage();
  }

  async getById(id) {
    const unit = await repo.findById(Number(id));
    if (!unit) throw { statusCode: 404, message: 'Unité introuvable' };
    return unit;
  }

  async create(data) {
    const exists = await repo.findByCode(data.code);
    if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    return repo.create(data);
  }

  async update(id, data) {
    const unit = await repo.findById(Number(id));
    if (!unit) throw { statusCode: 404, message: 'Unité introuvable' };
    if (data.code) {
      const exists = await repo.findByCode(data.code, Number(id));
      if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    }
    return repo.update(Number(id), data);
  }

  async delete(id) {
    const unit = await repo.findById(Number(id));
    if (!unit) throw { statusCode: 404, message: 'Unité introuvable' };
    await repo.softDelete(Number(id));
  }

  async toggleStatus(id) {
    const unit = await repo.findById(Number(id));
    if (!unit) throw { statusCode: 404, message: 'Unité introuvable' };
    return repo.update(Number(id), { status: unit.status === 'active' ? 'inactive' : 'active' });
  }

  async restore(id) {
    const unit = await repo.findByIdIncludingDeleted(Number(id));
    if (!unit) throw { statusCode: 404, message: 'Unité introuvable' };
    if (!unit.deleted_at) throw { statusCode: 400, message: "Cette unité n'est pas supprimée" };
    return repo.restore(Number(id));
  }

  async reorder(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw { statusCode: 400, message: 'Liste de réordonnancement invalide' };
    }
    await repo.reorder(items);
    return repo.findAll_noPage();
  }
}

module.exports = new UnitService();