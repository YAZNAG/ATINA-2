const repo = require('./nodeType.repository');

class NodeTypeService {
  async getAll() {
    return repo.findAll();
  }

  async create(data) {
    const exists = await repo.findByCode(data.code);
    if (exists) throw { statusCode: 409, message: 'Ce code type node existe déjà' };
    return repo.create(data);
  }
}

module.exports = new NodeTypeService();
