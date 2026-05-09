const repo = require('./nodeType.repository');

const ALLOWED = ['code', 'name_fr', 'name_ar', 'description', 'icon', 'color_badge', 'is_active'];

function pick(data) {
  return Object.fromEntries(Object.entries(data).filter(([k]) => ALLOWED.includes(k)));
}

class NodeTypeService {
  async getAll() {
    return repo.findAll();
  }

  async getAllActive() {
    return repo.findAllActive();
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Type node introuvable' };
    return item;
  }

  async create(data) {
    const exists = await repo.findByCode(data.code);
    if (exists) throw { statusCode: 409, message: 'Ce code type node existe déjà' };
    return await repo.create(pick(data));
  }

  async update(id, data) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Type node introuvable' };
    if (data.code) {
      const exists = await repo.findByCode(data.code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code type node existe déjà' };
    }
    return await repo.update(id, pick(data));
  }

  async delete(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Type node introuvable' };
    if (item._count?.nodes > 0)
      throw { statusCode: 409, message: 'Impossible de supprimer un type utilisé par des nodes' };
    await repo.remove(id);
  }
}

module.exports = new NodeTypeService();
