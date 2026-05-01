const repo = require('./nodeType.repository');

class NodeTypeService {
  async getAll() {
    return repo.findAll();
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Type node introuvable' };
    return item;
  }

  async create(data) {
    const exists = await repo.findByCode(data.code);
    if (exists) throw { statusCode: 409, message: 'Ce code type node existe déjà' };
    return repo.create(data);
  }

  async update(id, data) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Type node introuvable' };
    if (data.code) {
      const exists = await repo.findByCode(data.code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code type node existe déjà' };
    }
    return repo.update(id, data);
  }

  async delete(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Type node introuvable' };
    await repo.remove(id);
  }
}

module.exports = new NodeTypeService();
