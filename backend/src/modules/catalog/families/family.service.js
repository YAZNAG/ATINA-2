const repo = require('./family.repository');

const pickFamilyPayload = (body) => ({
  name_fr: body.name_fr,
  name_ar: body.name_ar,
  code: body.code,
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
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Famille introuvable' };
    return item;
  }

  async create(body) {
    const payload = pickFamilyPayload(body);
    const exists = await repo.findByCode(payload.code);
    if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    return repo.create(payload);
  }

  async update(id, body) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Famille introuvable' };
    if (body.code) {
      const exists = await repo.findByCode(body.code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    }
    const payload = pickFamilyPayload(body);
    return repo.update(id, payload);
  }

  async delete(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Famille introuvable' };
    const [subCount, articleCount] = await Promise.all([
      repo.countSubfamilies(id),
      repo.countArticles(id),
    ]);
    if (subCount > 0) {
      throw { statusCode: 400, message: 'Impossible de supprimer : cette famille contient des sous-familles' };
    }
    if (articleCount > 0) {
      throw { statusCode: 400, message: 'Impossible de supprimer : des articles sont rattachés à cette famille' };
    }
    await repo.softDelete(id);
  }

  async toggleStatus(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Famille introuvable' };
    return repo.update(id, { is_active: !item.is_active });
  }

  async reorder(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw { statusCode: 400, message: 'Liste "items" requise' };
    }
    return repo.reorder(items);
  }

  async restore(id) {
    const item = await repo.findByIdIncludingDeleted(id);
    if (!item) throw { statusCode: 404, message: 'Famille introuvable' };
    if (!item.deleted_at) throw { statusCode: 400, message: "Cette famille n'est pas supprimée" };
    return repo.restore(id);
  }
}

module.exports = new FamilyService();