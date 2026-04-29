const repo = require('./family.repository');
const fileUploadService = require('../../../services/fileUpload.service');

const FOLDER = 'families';

class FamilyService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getList() { return repo.findAll_noPage(); }

  async getById(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Famille introuvable' };
    return item;
  }

  async create(data, files) {
    const exists = await repo.findByCode(data.code);
    if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    const imagePaths = fileUploadService.extractPaths(files, FOLDER);
    return repo.create({
      ...data,
      sort_order: data.sort_order ? Number(data.sort_order) : 0,
      ...imagePaths,
    });
  }

  async update(id, data, files) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Famille introuvable' };
    if (data.code) {
      const exists = await repo.findByCode(data.code, Number(id));
      if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    }
    const updateData = { ...data };
    if (data.sort_order !== undefined) updateData.sort_order = Number(data.sort_order);
    if (files?.image?.[0]) {
      updateData.image_path = fileUploadService.replaceIfNew(item.image_path, files.image[0], FOLDER);
    }
    if (files?.icon?.[0]) {
      updateData.icon_path = fileUploadService.replaceIfNew(item.icon_path, files.icon[0], FOLDER);
    }
    return repo.update(Number(id), updateData);
  }

  async delete(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Famille introuvable' };
    const catCount = await repo.countCategories(Number(id));
    if (catCount > 0) throw { statusCode: 400, message: 'Impossible de supprimer : cette famille contient des catégories' };
    if (item.image_path) fileUploadService.deleteFileByPath(item.image_path);
    if (item.icon_path) fileUploadService.deleteFileByPath(item.icon_path);
    await repo.softDelete(Number(id));
  }
}

module.exports = new FamilyService();
