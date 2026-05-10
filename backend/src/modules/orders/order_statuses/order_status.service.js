const repo = require('./order_status.repository');

const pick  = (d) => { const o = {}; for (const k of ['code','name_fr','name_ar','color']) if (d[k] !== undefined) o[k] = d[k]; return o; };
const strip = (d) => ({ ...d, orders_count: d._count?.orders ?? 0, _count: undefined });

class OrderStatusService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    if (params.all === 'true' || params.all === true) return { data };
    const page = Number(params.page) || 1, limit = Number(params.limit) || 50;
    return { data: data.map(strip), pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }
  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Statut commande introuvable' };
    return strip(item);
  }
  async create(data) {
    const p = pick(data);
    if (!p.code?.trim())    throw { statusCode: 400, message: 'Code requis' };
    if (!p.name_fr?.trim()) throw { statusCode: 400, message: 'Nom (FR) requis' };
    if (!p.name_ar?.trim()) throw { statusCode: 400, message: 'Nom (AR) requis' };
    p.code = p.code.trim().toLowerCase().replace(/\s+/g, '_');
    if (await repo.findByCode(p.code)) throw { statusCode: 409, message: `Le code «${p.code}» existe déjà` };
    return repo.create(p);
  }
  async update(id, data) {
    if (!await repo.findById(id)) throw { statusCode: 404, message: 'Statut commande introuvable' };
    const p = {};
    if (data.name_fr !== undefined) { if (!data.name_fr?.trim()) throw { statusCode: 400, message: 'Nom (FR) requis' }; p.name_fr = data.name_fr.trim(); }
    if (data.name_ar !== undefined) { if (!data.name_ar?.trim()) throw { statusCode: 400, message: 'Nom (AR) requis' }; p.name_ar = data.name_ar.trim(); }
    if (data.color !== undefined) p.color = data.color;
    return repo.update(id, p);
  }
  async delete(id) {
    if (!await repo.findById(id)) throw { statusCode: 404, message: 'Statut commande introuvable' };
    const used = await repo.countUsage(id);
    if (used > 0) throw { statusCode: 409, message: `Ce statut est utilisé par ${used} commande(s) — suppression impossible` };
    await repo.remove(id);
  }
  async seed() { return repo.seed(); }
}

module.exports = new OrderStatusService();
