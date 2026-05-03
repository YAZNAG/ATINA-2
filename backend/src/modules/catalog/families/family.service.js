const repo = require('./family.repository');
const { persistFamilyFiles, removeFamilyMediaFolder } = require('../../../services/familyMedia.service');

const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

const pickFamilyPayload = (body) => ({
  name_fr: body.name_fr,
  name_ar: body.name_ar,
  code: body.code,
  description_fr: emptyToNull(body.description_fr),
  description_ar: emptyToNull(body.description_ar),
  status: body.status || 'active',
  sort_order:
    body.sort_order !== undefined && body.sort_order !== '' ? Number(body.sort_order) : 0,
});

class FamilyService {
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
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Famille introuvable' };
    return item;
  }

  async create(body, files) {
    const payload = pickFamilyPayload(body);
    const exists = await repo.findByCode(payload.code);
    if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    let row = await repo.create(payload);
    const paths = persistFamilyFiles(row.id, files, null);
    if (paths.image_path || paths.icon_path) {
      row = await repo.update(row.id, paths);
    }
    return row;
  }

  async update(id, body, files) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Famille introuvable' };
    if (body.code) {
      const exists = await repo.findByCode(body.code, Number(id));
      if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    }
    const payload = pickFamilyPayload(body);
    const paths = persistFamilyFiles(Number(id), files, item);
    const updateData = { ...payload, ...paths };
    return repo.update(Number(id), updateData);
  }

  async delete(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Famille introuvable' };
    const catCount = await repo.countCategories(Number(id));
    if (catCount > 0) throw { statusCode: 400, message: 'Impossible de supprimer : cette famille contient des catégories' };
    await repo.softDelete(Number(id));
    removeFamilyMediaFolder(Number(id));
  }
}

module.exports = new FamilyService();
