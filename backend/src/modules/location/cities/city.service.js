const prisma = require('../../../config/database');
const repo = require('./city.repository');

class CityService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async create(data) {
    const province = await prisma.province.findFirst({
      where: { id: data.province_id, is_deleted: false, is_active: true },
    });
    if (!province) throw { statusCode: 400, message: 'Province invalide ou inactive' };
    const exists = await repo.findByCode(data.code);
    if (exists) throw { statusCode: 409, message: 'Ce code ville existe déjà' };
    return repo.create(data);
  }

  async update(id, data) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Ville introuvable' };
    if (data.province_id) {
      const province = await prisma.province.findFirst({
        where: { id: data.province_id, is_deleted: false, is_active: true },
      });
      if (!province) throw { statusCode: 400, message: 'Province invalide ou inactive' };
    }
    if (data.code) {
      const exists = await repo.findByCode(data.code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code ville existe déjà' };
    }
    return repo.update(id, data);
  }
}

module.exports = new CityService();
