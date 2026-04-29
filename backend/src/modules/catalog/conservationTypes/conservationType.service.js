const repo = require('./conservationType.repository');

class ConservationTypeService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }
  async getList() { return repo.findAll_noPage(); }
  async getById(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Type de conservation introuvable' };
    return item;
  }
  async create(data) {
    const exists = await repo.findByCode(data.code);
    if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    const d = { ...data };
    if (data.min_temperature) d.min_temperature = parseFloat(data.min_temperature);
    if (data.max_temperature) d.max_temperature = parseFloat(data.max_temperature);
    return repo.create(d);
  }
  async update(id, data) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Type de conservation introuvable' };
    if (data.code) {
      const exists = await repo.findByCode(data.code, Number(id));
      if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    }
    const d = { ...data };
    if (data.min_temperature !== undefined) d.min_temperature = data.min_temperature ? parseFloat(data.min_temperature) : null;
    if (data.max_temperature !== undefined) d.max_temperature = data.max_temperature ? parseFloat(data.max_temperature) : null;
    return repo.update(Number(id), d);
  }
  async delete(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Type de conservation introuvable' };
    await repo.softDelete(Number(id));
  }
}

module.exports = new ConservationTypeService();
