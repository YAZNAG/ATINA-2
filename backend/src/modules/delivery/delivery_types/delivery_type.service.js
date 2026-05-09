const repo = require('./delivery_type.repository');

const FIELDS = ['code', 'name_fr', 'name_ar'];

const pick = (data) => {
  const out = {};
  for (const k of FIELDS) if (data[k] !== undefined) out[k] = data[k];
  return out;
};

class DeliveryTypeService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    if (params.all === 'true' || params.all === true) return { data };
    const page  = Number(params.page)  || 1;
    const limit = Number(params.limit) || 50;
    const mapped = data.map((d) => ({ ...d, orders_count: d._count?.orders ?? 0, _count: undefined }));
    return { data: mapped, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Type de livraison introuvable' };
    return { ...item, orders_count: item._count?.orders ?? 0, _count: undefined };
  }

  async create(data) {
    const payload = pick(data);
    if (!payload.code?.trim())    throw { statusCode: 400, message: 'Code requis' };
    if (!payload.name_fr?.trim()) throw { statusCode: 400, message: 'Nom (FR) requis' };
    if (!payload.name_ar?.trim()) throw { statusCode: 400, message: 'Nom (AR) requis' };
    payload.code = payload.code.trim().toLowerCase().replace(/\s+/g, '_');
    const exists = await repo.findByCode(payload.code);
    if (exists) throw { statusCode: 409, message: `Le code «${payload.code}» existe déjà` };
    return repo.create(payload);
  }

  async update(id, data) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Type de livraison introuvable' };
    const payload = {};
    if (data.name_fr !== undefined) {
      if (!data.name_fr?.trim()) throw { statusCode: 400, message: 'Nom (FR) requis' };
      payload.name_fr = data.name_fr.trim();
    }
    if (data.name_ar !== undefined) {
      if (!data.name_ar?.trim()) throw { statusCode: 400, message: 'Nom (AR) requis' };
      payload.name_ar = data.name_ar.trim();
    }
    return repo.update(id, payload);
  }

  async delete(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Type de livraison introuvable' };
    const used = await repo.countOrders(id);
    if (used > 0)
      throw { statusCode: 409, message: `Ce type est utilisé par ${used} commande(s) — suppression impossible` };
    await repo.remove(id);
  }

  async seed() {
    return repo.seed();
  }
}

module.exports = new DeliveryTypeService();
