const prisma = require('../../../config/database');
const repo = require('./province.repository');

class ProvinceService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async create(data) {
    const region = await prisma.region.findFirst({ where: { id: data.region_id, is_deleted: false, is_active: true } });
    if (!region) throw { statusCode: 400, message: 'Région invalide ou inactive' };
    const exists = await repo.findByCode(data.code);
    if (exists) throw { statusCode: 409, message: 'Ce code province existe déjà' };
    return repo.create(data);
  }

  async update(id, data) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Province introuvable' };
    if (data.region_id) {
      const region = await prisma.region.findFirst({ where: { id: data.region_id, is_deleted: false, is_active: true } });
      if (!region) throw { statusCode: 400, message: 'Région invalide ou inactive' };
    }
    if (data.code) {
      const exists = await repo.findByCode(data.code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code province existe déjà' };
    }
    return repo.update(id, data);
  }
}

module.exports = new ProvinceService();
