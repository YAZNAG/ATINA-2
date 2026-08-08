const repo = require('./category.repository');
const { persistCategoryFiles, removeCategoryMediaFolder } = require('../../../services/familyMedia.service');

const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

const pickCategoryPayload = (body) => ({
  name_fr: body.name_fr,
  name_ar: body.name_ar,
  code: body.code,
  family_id: Number(body.family_id),
  description_fr: emptyToNull(body.description_fr),
  description_ar: emptyToNull(body.description_ar),
  status: body.status || 'active',
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

  async getList(family_id) {
    return repo.findAll_noPage(family_id);
  }

  async getById(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Catégorie introuvable' };
    return item;
  }

  async create(body, files) {
    const payload = pickCategoryPayload(body);
    const exists = await repo.findByCode(payload.code);
    if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    let row = await repo.create(payload);
    const paths = persistCategoryFiles(row.id, files, null);
    if (paths.image_path || paths.icon_path) {
      row = await repo.update(row.id, paths);
    }
    return row;
  }

  async update(id, body, files) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Catégorie introuvable' };
    if (body.code) {
      const exists = await repo.findByCode(body.code, Number(id));
      if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    }
    const payload = pickCategoryPayload({ ...body, family_id: body.family_id ?? item.family_id });
    const paths = persistCategoryFiles(Number(id), files, item);
    return repo.update(Number(id), { ...payload, ...paths });
  }

  async delete(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Catégorie introuvable' };
    const subCount = await repo.countSubCategories(Number(id));
    if (subCount > 0) {
      throw { statusCode: 400, message: 'Impossible de supprimer : cette catégorie contient des sous-catégories' };
    }
    await repo.softDelete(Number(id));
    removeCategoryMediaFolder(Number(id));
  }

  async toggleStatus(id) {
  const item = await repo.findById(Number(id));
  if (!item) throw { statusCode: 404, message: 'Catégorie introuvable' };
  return repo.update(Number(id), { status: item.status === 'active' ? 'inactive' : 'active' });
}

async restore(id) {
  const item = await repo.findByIdIncludingDeleted(Number(id));
  if (!item) throw { statusCode: 404, message: 'Catégorie introuvable' };
  if (!item.deleted_at) throw { statusCode: 400, message: "Cette catégorie n'est pas supprimée" };
  return repo.restore(Number(id));
}
}

module.exports = new CategoryService();
