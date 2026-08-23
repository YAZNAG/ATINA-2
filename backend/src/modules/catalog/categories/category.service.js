const repo = require('./category.repository');
const { persistCategoryFiles, removeCategoryMediaFolder } = require('../../../services/familyMedia.service');

const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

const pickCategoryPayload = (body) => ({
  name_fr: body.name_fr,
  name_ar: body.name_ar,
  code: body.code,
  gpc_code: emptyToNull(body.gpc_code),
  is_active: body.is_active !== undefined ? body.is_active === true || body.is_active === 'true' : true,
  sort_order:
    body.sort_order !== undefined && body.sort_order !== '' ? Number(body.sort_order) : 0,
});

class CategoryService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getList() {
    return repo.findAll_noPage();
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Catégorie introuvable' };
    return item;
  }

  async create(body, files) {
    const payload = pickCategoryPayload(body);
    const exists = await repo.findByCode(payload.code);
    if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    let row = await repo.create(payload);
    // persistCategoryFiles renvoyait { image_path, icon_path } avant ;
    // le modèle n'a plus qu'image_url — adapte selon ta fonction de service réelle.
    const paths = persistCategoryFiles(row.id, files, null);
    if (paths.image_path) {
      row = await repo.update(row.id, { image_url: paths.image_path });
    }
    return row;
  }

  async update(id, body, files) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Catégorie introuvable' };
    if (body.code) {
      const exists = await repo.findByCode(body.code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    }
    const payload = pickCategoryPayload(body);
    const paths = persistCategoryFiles(id, files, item);
    const updateData = { ...payload };
    if (paths.image_path) updateData.image_url = paths.image_path;
    return repo.update(id, updateData);
  }

  async delete(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Catégorie introuvable' };
    const articleCount = await repo.countArticles(id);
    if (articleCount > 0) {
      throw { statusCode: 400, message: 'Impossible de supprimer : des articles sont encore rattachés à cette catégorie' };
    }
    await repo.softDelete(id);
    removeCategoryMediaFolder(id);
  }

  async toggleStatus(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Catégorie introuvable' };
    return repo.update(id, { is_active: !item.is_active });
  }

  async restore(id) {
    const item = await repo.findByIdIncludingDeleted(id);
    if (!item) throw { statusCode: 404, message: 'Catégorie introuvable' };
    if (!item.deleted_at) throw { statusCode: 400, message: "Cette catégorie n'est pas supprimée" };
    return repo.restore(id);
  }

      async reorder(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw { statusCode: 400, message: 'Liste "items" requise' };
    }
    return repo.reorder(items);
  }
}

module.exports = new CategoryService();