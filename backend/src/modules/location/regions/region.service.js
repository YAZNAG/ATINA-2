const repo = require('./region.repository');
const { audit } = require('../../../utils/audit');

const emptyToNull = (v) => (v === '' || v === undefined ? null : v);
const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1';

/**
 * Payload région.
 * - create : tous les champs (is_active = true par défaut).
 * - update : PARTIEL — seules les clés envoyées sont modifiées (un simple
 *   basculement de statut ne doit ni effacer les descriptions ni désactiver
 *   la région lors d'une édition sans is_active).
 */
const pickRegionPayload = (body = {}, mode = 'create') => {
  if (mode === 'create') {
    return {
      code: body.code !== undefined ? String(body.code).trim() : body.code,
      name_fr: body.name_fr !== undefined ? String(body.name_fr).trim() : body.name_fr,
      name_ar: body.name_ar !== undefined ? String(body.name_ar).trim() : body.name_ar,
      description_fr: emptyToNull(body.description_fr),
      description_ar: emptyToNull(body.description_ar),
      is_active: body.is_active === undefined ? true : toBool(body.is_active),
    };
  }
  const out = {};
  ['code', 'name_fr', 'name_ar'].forEach((k) => {
    if (body[k] !== undefined) out[k] = String(body[k]).trim();
  });
  ['description_fr', 'description_ar'].forEach((k) => {
    if (body[k] !== undefined) out[k] = emptyToNull(body[k]);
  });
  if (body.is_active !== undefined) out.is_active = toBool(body.is_active);
  return out;
};

const diff = (before, after) => {
  const old_values = {};
  const new_values = {};
  Object.entries(after).forEach(([k, v]) => {
    if (JSON.stringify(before[k] ?? null) !== JSON.stringify(v ?? null)) {
      old_values[k] = before[k] ?? null;
      new_values[k] = v ?? null;
    }
  });
  return { old_values, new_values };
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
    const [cityCount, nodeCount] = await Promise.all([repo.countCities(id), repo.countNodes(id)]);
    return { city_count: cityCount, node_count: nodeCount };
  }

  async create(body, userId, req = null) {
    const data = pickRegionPayload(body, 'create');
    if (!data.code) throw { statusCode: 400, message: 'Code requis' };
    if (!data.name_fr) throw { statusCode: 400, message: 'Nom FR requis' };
    if (!data.name_ar) throw { statusCode: 400, message: 'Nom AR requis' };
    const exists = await repo.findByCode(data.code);
    if (exists) {
      throw {
        statusCode: 409,
        message: exists.is_deleted
          ? 'Ce code est déjà utilisé par une région supprimée'
          : 'Ce code région existe déjà',
      };
    }
    const created = await repo.create({ ...data, created_by: userId ?? null });
    await audit(req, { action: 'CREATE', resource: 'regions', resource_id: created.id, new_values: data });
    return created;
  }

  async update(id, body, userId, req = null) {
    const data = pickRegionPayload(body, 'update');
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Région introuvable' };
    if (data.code !== undefined && !data.code) throw { statusCode: 400, message: 'Code requis' };
    if (data.name_fr !== undefined && !data.name_fr) throw { statusCode: 400, message: 'Nom FR requis' };
    if (data.name_ar !== undefined && !data.name_ar) throw { statusCode: 400, message: 'Nom AR requis' };
    if (data.code) {
      const exists = await repo.findByCode(data.code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code région existe déjà' };
    }
    const updated = await repo.update(id, { ...data, updated_by: userId ?? null });
    const { old_values, new_values } = diff(item, data);
    const changed = Object.keys(new_values);
    if (changed.length) {
      let action = 'UPDATE';
      if (changed.length === 1 && changed[0] === 'is_active') action = data.is_active ? 'ACTIVATE' : 'DEACTIVATE';
      await audit(req, { action, resource: 'regions', resource_id: id, old_values, new_values });
    }
    return updated;
  }

  /**
   * Suppression en cascade : la région est soft-deletée, ainsi que TOUTES ses
   * villes rattachées directement (une ville ne peut exister sans région).
   * Un node rattaché à la région bloque la suppression, car il correspond à une
   * opération logistique, pas à de la simple donnée de référence.
   */
  async delete(id, userId, req = null) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Région introuvable' };

    const nodeCount = await repo.countNodes(id);
    if (nodeCount > 0) {
      throw {
        statusCode: 400,
        message: `Impossible de supprimer : ${nodeCount} node(s) sont rattachés à cette région. Déplacez ou supprimez-les d'abord.`,
      };
    }

    const { city_count, cities } = await repo.softDeleteCascade(id, userId);
    await audit(req, {
      action: 'DELETE',
      resource: 'regions',
      resource_id: id,
      old_values: { code: item.code, name_fr: item.name_fr, is_deleted: false },
      new_values: { is_deleted: true, cascade_cities: (cities || []).map((c) => c.code) },
    });
    return { city_count };
  }
}

module.exports = new RegionService();
