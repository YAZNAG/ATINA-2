const repo = require('./brand.repository');
const fileUploadService = require('../../../services/fileUpload.service');

const FOLDER = 'brands';

class BrandService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }
  async getList() { return repo.findAll_noPage(); }
  async getById(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Marque introuvable' };
    return item;
  }
  async create(data, files) {
    const exists = await repo.findByCode(data.code);
    if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    const paths = fileUploadService.extractPaths(files, FOLDER);
    return repo.create({ ...data, ...paths });
  }
  async update(id, data, files) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Marque introuvable' };
    if (data.code) {
      const exists = await repo.findByCode(data.code, Number(id));
      if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    }
    const updateData = { ...data };
    if (files?.logo?.[0]) updateData.logo = fileUploadService.replaceIfNew(item.logo, files.logo[0], FOLDER);
    return repo.update(Number(id), updateData);
  }
  async delete(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Marque introuvable' };
    if (item.logo) fileUploadService.deleteFileByPath(item.logo);
    await repo.softDelete(Number(id));
  }
}

module.exports = new BrandService();
