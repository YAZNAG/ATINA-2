const prisma = require('../../../config/database');
const repo = require('./city.repository');
const { audit } = require('../../../utils/audit');

const FIELDS = ['code', 'name_fr', 'name_ar', 'postal_code', 'is_active', 'region_id', 'sort_order'];
const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1';

/** Payload partiel : seules les clés envoyées sont retenues (whitelist). */
const pick = (body = {}) => {
  const out = {};
  FIELDS.forEach((k) => { if (body[k] !== undefined) out[k] = body[k]; });
  ['code', 'name_fr', 'name_ar'].forEach((k) => {
    if (out[k] !== undefined) out[k] = String(out[k] ?? '').trim();
  });
  if (out.postal_code !== undefined) {
    const s = out.postal_code === null ? '' : String(out.postal_code).trim();
    out.postal_code = s === '' ? null : s;
  }
  if (out.is_active !== undefined) out.is_active = toBool(out.is_active);
  if (out.region_id === '' || out.region_id === null) delete out.region_id;
  if (out.sort_order !== undefined) {
    const n = Number(out.sort_order);
    if (out.sort_order === '' || out.sort_order === null || Number.isNaN(n)) delete out.sort_order;
    else out.sort_order = Math.max(0, Math.trunc(n));
  }
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

class CityService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Ville introuvable' };
    return item;
  }

  async _assertRegion(regionId) {
    const region = await prisma.region.findFirst({
      where: { id: regionId, is_deleted: false, is_active: true },
    });
    if (!region) throw { statusCode: 400, message: 'Région invalide ou inactive' };
    return region;
  }

  async create(body, req = null) {
    const data = pick(body);
    // ORDRE OBLIGATOIRE : la région parente doit exister (une ville ne peut exister sans région).
    if (!data.region_id) throw { statusCode: 400, message: 'La région parente est obligatoire' };
    if (!data.code) throw { statusCode: 400, message: 'Code requis' };
    if (!data.name_fr) throw { statusCode: 400, message: 'Nom FR requis' };
    if (!data.name_ar) throw { statusCode: 400, message: 'Nom AR requis' };
    await this._assertRegion(data.region_id);
    const exists = await repo.findByCode(data.code);
    if (exists) {
      throw {
        statusCode: 409,
        message: exists.is_deleted ? 'Ce code est déjà utilisé par une ville supprimée' : 'Ce code ville existe déjà',
      };
    }
    if (data.sort_order === undefined) data.sort_order = await repo.nextSortOrder(data.region_id);
    data.created_by = req?.user?.id ?? null;
    const created = await repo.create(data);
    await audit(req, { action: 'CREATE', resource: 'cities', resource_id: created.id, new_values: data });
    return created;
  }

  async update(id, body, req = null) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Ville introuvable' };
    const data = pick(body);
    if (data.code !== undefined && !data.code) throw { statusCode: 400, message: 'Code requis' };
    if (data.name_fr !== undefined && !data.name_fr) throw { statusCode: 400, message: 'Nom FR requis' };
    if (data.name_ar !== undefined && !data.name_ar) throw { statusCode: 400, message: 'Nom AR requis' };
    if (data.code) {
      const exists = await repo.findByCode(data.code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code ville existe déjà' };
    }

    const { old_values, new_values } = diff(item, data);
    const changed = Object.keys(new_values);

    let updated;
    let nodesUpdated = 0;
    if (data.region_id && data.region_id !== item.region_id) {
      // Changement de région = déplacement (les nodes de la ville suivent).
      await this._assertRegion(data.region_id);
      const { region_id, ...rest } = data;
      if (rest.sort_order === undefined) rest.sort_order = await repo.nextSortOrder(region_id);
      const moved = await repo.moveToRegion(id, region_id, rest);
      updated = moved.city;
      nodesUpdated = moved.nodes_updated;
    } else {
      const { region_id, ...rest } = data;
      updated = await repo.update(id, rest);
    }

    if (changed.length) {
      let action = 'UPDATE';
      if (changed.length === 1 && changed[0] === 'is_active') action = data.is_active ? 'ACTIVATE' : 'DEACTIVATE';
      if (changed.includes('region_id')) action = 'MOVE_CITY';
      await audit(req, {
        action,
        resource: 'cities',
        resource_id: id,
        old_values,
        new_values: nodesUpdated ? { ...new_values, nodes_updated: nodesUpdated } : new_values,
      });
    }
    return updated;
  }

  /** Rattacher / déplacer une ville vers une autre région (onglet « Rattachement Ville → Région »). */
  async move(id, regionId, req = null) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Ville introuvable' };
    if (!regionId) throw { statusCode: 400, message: 'Région cible requise' };
    if (regionId === item.region_id) throw { statusCode: 400, message: 'La ville est déjà rattachée à cette région' };
    const target = await this._assertRegion(regionId);
    const sort_order = await repo.nextSortOrder(regionId);
    const { city, nodes_updated } = await repo.moveToRegion(id, regionId, { sort_order });
    await audit(req, {
      action: 'MOVE_CITY',
      resource: 'cities',
      resource_id: id,
      old_values: { region_id: item.region_id, region_code: item.region?.code ?? null },
      new_values: { region_id: regionId, region_code: target.code, nodes_updated },
    });
    return { ...city, nodes_updated };
  }

  /** Réordonnancement ↑↓ d'une ville dans sa région (sort_order). */
  async reorder(id, direction, req = null) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Ville introuvable' };
    if (!['up', 'down'].includes(direction)) throw { statusCode: 400, message: 'Direction invalide (up ou down)' };
    const { moved, rows } = await repo.reorderInRegion(id, item.region_id, direction);
    if (!moved) {
      throw {
        statusCode: 400,
        message: direction === 'up' ? 'La ville est déjà en tête de liste' : 'La ville est déjà en fin de liste',
      };
    }
    const newOrder = rows.find((r) => r.id === id)?.sort_order ?? null;
    await audit(req, {
      action: 'REORDER',
      resource: 'cities',
      resource_id: id,
      old_values: { sort_order: item.sort_order },
      new_values: { sort_order: newOrder, direction },
    });
    return { id, sort_order: newOrder, order: rows };
  }

  async delete(id, req = null) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Ville introuvable' };
    // Suppression bloquée tant que des nodes, clients ou adresses actifs y sont rattachés.
    const deps = await repo.countDependencies(id);
    const parts = [];
    if (deps.nodes > 0) parts.push(`${deps.nodes} node(s)`);
    if (deps.customers > 0) parts.push(`${deps.customers} client(s)`);
    if (deps.addresses > 0) parts.push(`${deps.addresses} adresse(s)`);
    if (parts.length) {
      throw {
        statusCode: 400,
        message: `Impossible de supprimer : ${parts.join(', ')} actif(s) sont rattaché(s) à cette ville. Désactivez-la à la place.`,
      };
    }
    // Soft-delete (is_deleted + deleted_at) : la ville disparaît des listes.
    await repo.softDelete(id);
    await audit(req, {
      action: 'DELETE',
      resource: 'cities',
      resource_id: id,
      old_values: { code: item.code, name_fr: item.name_fr, region_id: item.region_id, is_deleted: false },
      new_values: { is_deleted: true, is_active: false, deleted_at: new Date().toISOString() },
    });
  }
}

module.exports = new CityService();
