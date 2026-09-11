const repo = require('./brand.repository');
const { audit } = require('../../../utils/audit');
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

const AUDIT_FIELDS = ['code', 'name_fr', 'name_ar', 'status', 'description_fr', 'description_ar', 'logo'];

/** Diff avant / après limité aux champs réellement modifiés. */
const diffBrand = (before, after) => {
  const old_values = {};
  const new_values = {};
  AUDIT_FIELDS.forEach((k) => {
    if (after[k] === undefined) return;
    if (JSON.stringify(before?.[k] ?? null) !== JSON.stringify(after[k] ?? null)) {
      old_values[k] = before?.[k] ?? null;
      new_values[k] = after[k] ?? null;
    }
  });
  return { old_values, new_values };
};

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

  async create(data, files, req = null) {
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
    await audit(req, { action: 'CREATE', resource: 'brands', resource_id: row.id, new_values: { ...payload, ...paths } });
    return row;
  }

  async update(id, data, files, req = null) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Marque introuvable' };
    const payload = pickBrandPayload(data, 'update');
    if (payload.code) {
      const exists = await repo.findByCode(payload.code, Number(id));
      if (exists) throw { statusCode: 409, message: 'Ce code est déjà utilisé' };
    }
    const paths = persistBrandLogo(Number(id), files, item);

    try {
      const updated = await repo.update(Number(id), { ...payload, ...paths });
      const { old_values, new_values } = diffBrand(item, { ...payload, ...paths });
      const changed = Object.keys(new_values);
      if (changed.length) {
        let action = 'UPDATE';
        if (changed.length === 1 && changed[0] === 'status') {
          action = new_values.status === 'active' ? 'ACTIVATE' : 'DEACTIVATE';
        }
        await audit(req, { action, resource: 'brands', resource_id: Number(id), old_values, new_values });
      }
      return updated;
    } catch (err) {
      if (isUniqueCodeViolation(err)) {
        throw { statusCode: 409, message: CODE_TAKEN_BY_DELETED_MSG };
      }
      throw err;
    }
  }

  async delete(id, req = null) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Marque introuvable' };
    // US-022 / WF-12 : suppression refusée tant que des SKU sont rattachés (ON DELETE RESTRICT).
    const skuCount = await repo.countSkus(Number(id));
    if (skuCount > 0) {
      throw {
        statusCode: 400,
        message: `Impossible de supprimer : ${skuCount} produit(s) utilisent cette marque. Désactivez-la à la place.`,
      };
    }
    if (item.logo) {
      const { deleteFile } = require('../../../utils/fileStorage');
      deleteFile(item.logo);
    }
    await repo.softDelete(Number(id));
    removeBrandMediaFolder(Number(id));
    await audit(req, {
      action: 'DELETE',
      resource: 'brands',
      resource_id: Number(id),
      old_values: { code: item.code, name_fr: item.name_fr, status: item.status, deleted_at: null },
      new_values: { deleted_at: new Date().toISOString() },
    });
  }
}

module.exports = new BrandService();