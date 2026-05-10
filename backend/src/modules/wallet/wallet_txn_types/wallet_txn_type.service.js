const repo = require('./wallet_txn_type.repository');

const pick = (d) => { const o = {}; for (const k of ['code','name_fr','name_ar','direction']) if (d[k] !== undefined) o[k] = d[k]; return o; };

class WalletTxnTypeService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    if (params.all === 'true' || params.all === true) return { data };
    const page = Number(params.page) || 1, limit = Number(params.limit) || 50;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }
  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Type de transaction wallet introuvable' };
    return item;
  }
  async create(data) {
    const p = pick(data);
    if (!p.code?.trim())      throw { statusCode: 400, message: 'Code requis' };
    if (!p.name_fr?.trim())   throw { statusCode: 400, message: 'Nom (FR) requis' };
    if (!p.name_ar?.trim())   throw { statusCode: 400, message: 'Nom (AR) requis' };
    if (!p.direction)         throw { statusCode: 400, message: 'Direction requise (IN ou OUT)' };
    p.direction = p.direction.toUpperCase();
    if (!repo.VALID_DIRS.includes(p.direction)) throw { statusCode: 400, message: 'Direction invalide — valeurs autorisées : IN, OUT' };
    p.code = p.code.trim().toLowerCase().replace(/\s+/g, '_');
    if (await repo.findByCode(p.code)) throw { statusCode: 409, message: `Le code «${p.code}» existe déjà` };
    return repo.create(p);
  }
  async update(id, data) {
    if (!await repo.findById(id)) throw { statusCode: 404, message: 'Type de transaction wallet introuvable' };
    const p = {};
    if (data.name_fr  !== undefined) { if (!data.name_fr?.trim())  throw { statusCode: 400, message: 'Nom (FR) requis' };  p.name_fr  = data.name_fr.trim(); }
    if (data.name_ar  !== undefined) { if (!data.name_ar?.trim())  throw { statusCode: 400, message: 'Nom (AR) requis' };  p.name_ar  = data.name_ar.trim(); }
    if (data.direction !== undefined) {
      const d = data.direction.toUpperCase();
      if (!repo.VALID_DIRS.includes(d)) throw { statusCode: 400, message: 'Direction invalide — valeurs autorisées : IN, OUT' };
      p.direction = d;
    }
    return repo.update(id, p);
  }
  async delete(id) {
    if (!await repo.findById(id)) throw { statusCode: 404, message: 'Type de transaction wallet introuvable' };
    await repo.remove(id);
  }
  async seed() { return repo.seed(); }
}

module.exports = new WalletTxnTypeService();
