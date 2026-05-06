const prisma = require('../../../config/database');
const repo = require('./location.repository');

const genLabel = (aisle, shelf, levelCode) =>
  `${String(aisle).toUpperCase()}-${String(shelf).padStart(2, '0')}-${levelCode}`;

const pick = (data) => {
  const out = {};
  const fields = ['node_id', 'aisle', 'shelf', 'level_id', 'zone_id', 'is_active'];
  for (const k of fields) if (data[k] !== undefined) out[k] = data[k];
  if (out.is_active !== undefined) out.is_active = out.is_active === true || out.is_active === 'true';
  if (out.zone_id === '' || out.zone_id === null) out.zone_id = null;
  return out;
};

class LocationService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    if (params.all === 'true' || params.all === true) return { data };
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Emplacement introuvable' };
    return item;
  }

  async create(data) {
    const payload = pick(data);
    if (!payload.node_id) throw { statusCode: 400, message: 'Node requis' };
    if (!payload.aisle) throw { statusCode: 400, message: 'Allée requise' };
    if (!payload.shelf) throw { statusCode: 400, message: 'Rayon requis' };
    if (!payload.level_id) throw { statusCode: 400, message: 'Niveau requis' };

    const level = await prisma.level.findUnique({ where: { id: payload.level_id } });
    if (!level) throw { statusCode: 400, message: 'Niveau introuvable' };

    const dup = await repo.findDuplicate(payload.node_id, payload.aisle, payload.shelf, payload.level_id, null);
    if (dup) throw { statusCode: 409, message: `L'emplacement ${genLabel(payload.aisle, payload.shelf, level.code)} existe déjà dans ce node` };

    payload.label = genLabel(payload.aisle, payload.shelf, level.code);
    return repo.create(payload);
  }

  async update(id, data) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Emplacement introuvable' };
    const payload = pick(data);

    const aisle = payload.aisle ?? item.aisle;
    const shelf = payload.shelf ?? item.shelf;
    const level_id = payload.level_id ?? item.level_id;

    const level = await prisma.level.findUnique({ where: { id: level_id } });
    if (!level) throw { statusCode: 400, message: 'Niveau introuvable' };

    if (payload.aisle || payload.shelf || payload.level_id) {
      const dup = await repo.findDuplicate(item.node_id, aisle, shelf, level_id, id);
      if (dup) throw { statusCode: 409, message: `L'emplacement ${genLabel(aisle, shelf, level.code)} existe déjà dans ce node` };
      payload.label = genLabel(aisle, shelf, level.code);
    }

    return repo.update(id, payload);
  }

  async delete(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Emplacement introuvable' };
    const skuCount = await prisma.skuNodeLocation.count({ where: { location_id: id, is_active: true } });
    if (skuCount > 0) throw { statusCode: 409, message: `Cet emplacement a ${skuCount} SKU(s) affecté(s). Retirez les affectations d'abord.` };
    await repo.softDelete(id);
  }

  async bulkGenerate({ node_id, aisles, shelves, level_ids, zone_id }) {
    if (!node_id) throw { statusCode: 400, message: 'Node requis' };
    if (!aisles?.length) throw { statusCode: 400, message: 'Au moins une allée requise' };
    if (!shelves?.length) throw { statusCode: 400, message: 'Au moins un rayon requis' };
    if (!level_ids?.length) throw { statusCode: 400, message: 'Au moins un niveau requis' };

    const levels = await prisma.level.findMany({ where: { id: { in: level_ids } } });
    const levelMap = Object.fromEntries(levels.map((l) => [l.id, l]));

    const created = [];
    const skipped = [];
    const errors = [];

    for (const aisle of aisles) {
      for (const shelf of shelves) {
        for (const level_id of level_ids) {
          const level = levelMap[level_id];
          if (!level) { errors.push(`Niveau ${level_id} introuvable`); continue; }
          const label = genLabel(aisle, shelf, level.code);
          const dup = await repo.findDuplicate(node_id, aisle, shelf, level_id, null);
          if (dup) { skipped.push(label); continue; }
          try {
            const loc = await repo.create({ node_id, aisle, shelf, level_id, zone_id: zone_id || null, label });
            created.push(loc.label);
          } catch (err) {
            errors.push(`${label}: ${err.message || 'Erreur'}`);
          }
        }
      }
    }

    return { created: created.length, skipped: skipped.length, errors: errors.length, details: { created, skipped, errors } };
  }
}

module.exports = new LocationService();
