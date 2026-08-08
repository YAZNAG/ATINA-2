const repo = require('./brand.repository');
const { persistBrandLogo, removeBrandMediaFolder } = require('../../../services/familyMedia.service');

const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

const pickBrandPayload = (body, mode = 'create') => {
  const base = {
    name_fr: body.name_fr,
    name_ar: body.name_ar,
    code: body.code,
    status: body.status || 'active',
  };
  if (mode === 'create') {
    return {
      ...base,
      description_fr: emptyToNull(body.description_fr),
      description_ar: emptyToNull(body.description_ar),
    };
  }
  const out = { ...base };
  if (body.description_fr !== undefined) out.description_fr = emptyToNull(body.description_fr);
  if (body.description_ar !== undefined) out.description_ar = emptyToNull(body.description_ar);
  return out;
};

// Message renvoyé quand la contrainte @unique de Postgres bloque l'insert/update
// parce que le code est déjà pris par une marque soft-deleted (findByCode ne la voit pas,
// mais la contrainte SQL, elle, ne fait pas la différence).
const CODE_TAKEN_BY_DELETED_MSG =
  "Ce code est déjà utilisé par une marque supprimée. Choisissez un autre code, ou demandez à un administrateur de restaurer l'ancienne marque.";

const isUniqueCodeViolation = (err) => err?.code === 'P2002' && err?.meta?.target?.includes('code');

class BrandService {
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
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Marque introuvable' };
    return item;
  }

  async create(data, files) {
    const payload = pickBrandPayload(data, 'create');
    const exists = await repo.findByCode(payload.code);
    if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };

    let row;
    try {
      row = await repo.create(payload);
    } catch (err) {
      if (isUniqueCodeViolation(err)) {
        throw { statusCode: 409, message: CODE_TAKEN_BY_DELETED_MSG };
      }
      throw err;
    }

    const paths = persistBrandLogo(row.id, files, null);
    if (paths.logo) {
      row = await repo.update(row.id, paths);
    }
    return row;
  }

  async update(id, data, files) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Marque introuvable' };
    const payload = pickBrandPayload(data, 'update');
    if (payload.code) {
      const exists = await repo.findByCode(payload.code, Number(id));
      if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    }
    const paths = persistBrandLogo(Number(id), files, item);

    try {
      return await repo.update(Number(id), { ...payload, ...paths });
    } catch (err) {
      if (isUniqueCodeViolation(err)) {
        throw { statusCode: 409, message: CODE_TAKEN_BY_DELETED_MSG };
      }
      throw err;
    }
  }

  async delete(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Marque introuvable' };
    if (item.logo) {
      const { deleteFile } = require('../../../utils/fileStorage');
      deleteFile(item.logo);
    }
    await repo.softDelete(Number(id));
    removeBrandMediaFolder(Number(id));
  }
}

module.exports = new BrandService();