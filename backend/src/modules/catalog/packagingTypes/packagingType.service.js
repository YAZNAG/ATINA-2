const repo = require('./packagingType.repository');

class PackagingTypeService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }
  async getList(params) { return repo.findAll_noPage(params); }
  async getById(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Conditionnement introuvable' };
    return item;
  }
  async create(data) {
    const exists = await repo.findByCode(data.code);
    if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    const createData = { ...data };
    if (data.unit_id) createData.unit_id = Number(data.unit_id);
    if (data.quantity) createData.quantity = parseFloat(data.quantity);
    return repo.create(createData);
  }
  async update(id, data) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Conditionnement introuvable' };
    if (data.code) {
      const exists = await repo.findByCode(data.code, Number(id));
      if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    }
    const updateData = { ...data };
    if (data.unit_id) updateData.unit_id = Number(data.unit_id);
    if (data.quantity) updateData.quantity = parseFloat(data.quantity);
    return repo.update(Number(id), updateData);
  }
  async delete(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Conditionnement introuvable' };
    await repo.softDelete(Number(id));
  }
}

module.exports = new PackagingTypeService();
