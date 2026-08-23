const repo = require('./subfamily.repository');

const pickSubfamilyPayload = (body) => ({
  name_fr: body.name_fr,
  name_ar: body.name_ar,
  code: body.code,
  family_id: body.family_id,
});

class SubfamilyService {
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
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Sous-famille introuvable' };
    return item;
  }

  async create(body) {
    const family = await repo.findFamilyById(body.family_id);
    if (!family) throw { statusCode: 400, message: 'Famille invalide' };
    const payload = pickSubfamilyPayload(body);
    const exists = await repo.findByCode(payload.code);
    if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    return repo.create(payload);
  }

  async update(id, body) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Sous-famille introuvable' };
    if (body.family_id) {
      const family = await repo.findFamilyById(body.family_id);
      if (!family) throw { statusCode: 400, message: 'Famille invalide' };
    }
    if (body.code) {
      const exists = await repo.findByCode(body.code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    }
    const payload = pickSubfamilyPayload({ ...body, family_id: body.family_id ?? item.family_id });
    return repo.update(id, payload);
  }

  async delete(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Sous-famille introuvable' };
    const articleCount = await repo.countArticles(id);
    if (articleCount > 0) {
      throw { statusCode: 400, message: 'Impossible de supprimer : des articles sont rattachés à cette sous-famille' };
    }
    await repo.softDelete(id);
  }

  async toggleStatus(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Sous-famille introuvable' };
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
    if (!item) throw { statusCode: 404, message: 'Sous-famille introuvable' };
    if (!item.deleted_at) throw { statusCode: 400, message: "Cette sous-famille n'est pas supprimée" };
    return repo.restore(id);
  }
}

module.exports = new SubfamilyService();