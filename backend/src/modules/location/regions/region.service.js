const repo = require('./region.repository');

const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

const pickRegionPayload = (body, mode = 'create') => {
  const out = {
    code: body.code,
    name_fr: body.name_fr,
    name_ar: body.name_ar,
    description_fr: emptyToNull(body.description_fr),
    description_ar: emptyToNull(body.description_ar),
    is_active:
      mode === 'create' && body.is_active === undefined ? true : Boolean(body.is_active),
  };
  return out;
};

class RegionService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Région introuvable' };
    return item;
  }

  async getStats(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Région introuvable' };
    const provinceCount = await repo.countProvinces(id);
    const cityCount = await repo.countCities(id);
    return { province_count: provinceCount, city_count: cityCount };
  }

  async create(body, userId) {
    const data = pickRegionPayload(body, 'create');
    const exists = await repo.findByCode(data.code);
    if (exists) throw { statusCode: 409, message: 'Ce code région existe déjà' };
    return repo.create({ ...data, created_by: userId });
  }

  async update(id, body, userId) {
    const data = pickRegionPayload(body, 'update');
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Région introuvable' };
    if (data.code) {
      const exists = await repo.findByCode(data.code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code région existe déjà' };
    }
    return repo.update(id, { ...data, updated_by: userId });
  }

  /**
   * Suppression en cascade : la région est soft-deletée, ainsi que TOUTES ses
   * provinces et TOUTES les villes de ces provinces, automatiquement.
   * Seul un lien direct région -> nodes bloque encore la suppression, car un
   * node actif rattaché à la région correspond à une opération logistique en
   * cours, pas à de la simple donnée de référence.
   */
  async delete(id, userId) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Région introuvable' };

    const nodeCount = await repo.countNodes(id);
    if (nodeCount > 0) {
      throw {
        statusCode: 400,
        message: 'Impossible de supprimer : cette région est directement liée à des nodes actifs.',
      };
    }

    const { province_count, city_count } = await repo.softDeleteCascade(id, userId);
    return { province_count, city_count };
  }
}

module.exports = new RegionService();