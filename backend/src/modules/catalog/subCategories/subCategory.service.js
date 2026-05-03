const repo = require('./subCategory.repository');
const { persistSubCategoryFiles, removeSubCategoryMediaFolder } = require('../../../services/familyMedia.service');

const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

const pickSubCategoryPayload = (body) => ({
  name_fr: body.name_fr,
  name_ar: body.name_ar,
  code: body.code,
  category_id: Number(body.category_id),
  description_fr: emptyToNull(body.description_fr),
  description_ar: emptyToNull(body.description_ar),
  status: body.status || 'active',
  sort_order:
    body.sort_order !== undefined && body.sort_order !== '' ? Number(body.sort_order) : 0,
});

class SubCategoryService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getList(category_id) {
    return repo.findAll_noPage(category_id);
  }

  async getById(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Sous-catégorie introuvable' };
    return item;
  }

  async create(body, files) {
    const payload = pickSubCategoryPayload(body);
    const exists = await repo.findByCode(payload.code);
    if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    let row = await repo.create(payload);
    const paths = persistSubCategoryFiles(row.id, files, null);
    if (paths.image_path || paths.icon_path) {
      row = await repo.update(row.id, paths);
    }
    return row;
  }

  async update(id, body, files) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Sous-catégorie introuvable' };
    if (body.code) {
      const exists = await repo.findByCode(body.code, Number(id));
      if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    }
    const payload = pickSubCategoryPayload(body);
    const paths = persistSubCategoryFiles(Number(id), files, item);
    return repo.update(Number(id), { ...payload, ...paths });
  }

  async delete(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Sous-catégorie introuvable' };
    const artCount = await repo.countArticles(Number(id));
    if (artCount > 0) {
      throw { statusCode: 400, message: 'Impossible de supprimer : cette sous-catégorie contient des articles' };
    }
    await repo.softDelete(Number(id));
    removeSubCategoryMediaFolder(Number(id));
  }
}

module.exports = new SubCategoryService();
