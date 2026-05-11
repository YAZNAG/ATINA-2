const repo = require('./pick_item_status.repository');
const PROTECTED = ['pending','picked','substituted','out_of_stock'];

const pick = (d) => { const o={}; for (const k of ['code','name_fr','name_ar']) if (d[k]!==undefined) o[k]=d[k]; return o; };
const strip = (d) => ({ ...d, items_count: d._count?.session_items ?? 0, _count: undefined });

class PickItemStatusService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    if (params.all === 'true') return { data };
    const page = Number(params.page)||1, limit = Number(params.limit)||50;
    return { data: data.map(strip), pagination: { total, page, limit, pages: Math.ceil(total/limit) } };
  }
  async getById(id) {
    const s = await repo.findById(id);
    if (!s) throw { statusCode:404, message:'Statut article picking introuvable' };
    return strip(s);
  }
  async create(data) {
    const p = pick(data);
    if (!p.code?.trim())    throw { statusCode:400, message:'Code requis' };
    if (!p.name_fr?.trim()) throw { statusCode:400, message:'Nom (FR) requis' };
    if (!p.name_ar?.trim()) throw { statusCode:400, message:'Nom (AR) requis' };
    p.code = p.code.trim().toLowerCase().replace(/\s+/g,'_');
    if (await repo.findByCode(p.code)) throw { statusCode:409, message:`Le code «${p.code}» existe déjà` };
    return repo.create(p);
  }
  async update(id, data) {
    const existing = await repo.findById(id);
    if (!existing) throw { statusCode:404, message:'Statut article picking introuvable' };
    const p = {};
    if (data.name_fr !== undefined) { if (!data.name_fr?.trim()) throw { statusCode:400, message:'Nom (FR) requis' }; p.name_fr = data.name_fr.trim(); }
    if (data.name_ar !== undefined) { if (!data.name_ar?.trim()) throw { statusCode:400, message:'Nom (AR) requis' }; p.name_ar = data.name_ar.trim(); }
    return repo.update(id, p);
  }
  async delete(id) {
    const existing = await repo.findById(id);
    if (!existing) throw { statusCode:404, message:'Statut article picking introuvable' };
    if (PROTECTED.includes(existing.code)) throw { statusCode:409, message:`Le statut «${existing.code}» est protégé` };
    const used = await repo.countUsage(id);
    if (used > 0) throw { statusCode:409, message:`Ce statut est utilisé par ${used} article(s) — suppression impossible` };
    await repo.remove(id);
  }
  async seed() { return repo.seed(); }
}
module.exports = new PickItemStatusService();
