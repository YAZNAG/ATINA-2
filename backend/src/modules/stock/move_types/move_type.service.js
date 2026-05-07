const repo = require('./move_type.repository');

const ALLOWED_OPS = ['IN', 'OUT', 'ADJ', 'TRF'];
const FIELDS = ['code', 'name_fr', 'name_ar', 'operation', 'color'];

const pick = (data) => {
  const out = {};
  for (const k of FIELDS) if (data[k] !== undefined) out[k] = data[k];
  return out;
};

class MoveTypeService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    if (params.all === 'true' || params.all === true) return { data };
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Type de mouvement introuvable' };
    return item;
  }

  async create(data) {
    const payload = pick(data);
    if (!payload.code) throw { statusCode: 400, message: 'Code requis' };
    if (!payload.name_fr) throw { statusCode: 400, message: 'Nom (FR) requis' };
    if (!payload.operation) throw { statusCode: 400, message: 'Opération requise' };
    if (!ALLOWED_OPS.includes(payload.operation))
      throw { statusCode: 400, message: 'Opération invalide — valeurs autorisées : IN, OUT, ADJ, TRF' };
    const exists = await repo.findByCode(payload.code);
    if (exists) throw { statusCode: 409, message: 'Ce code de type de mouvement existe déjà' };
    return repo.create(payload);
  }

  async update(id, data) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Type de mouvement introuvable' };
    const payload = pick(data);
    if (payload.operation && !ALLOWED_OPS.includes(payload.operation))
      throw { statusCode: 400, message: 'Opération invalide — valeurs autorisées : IN, OUT, ADJ, TRF' };
    if (payload.code) {
      const exists = await repo.findByCode(payload.code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code de type de mouvement existe déjà' };
    }
    return repo.update(id, payload);
  }

  async delete(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Type de mouvement introuvable' };
    const prisma = require('../../../config/database');
    const used = await prisma.stockMove.count({ where: { move_type_id: id } });
    if (used > 0) throw { statusCode: 409, message: `Ce type est utilisé par ${used} mouvement(s) de stock` };
    await repo.remove(id);
  }
}

module.exports = new MoveTypeService();
