const prisma = require('../../../config/database');
const repo = require('./node.repository');

class NodeService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Node introuvable' };
    return item;
  }

  async _validateRefs(data) {
    const [type, region, province, city] = await Promise.all([
      data.node_type_id ? prisma.nodeType.findUnique({ where: { id: data.node_type_id } }) : null,
      data.region_id ? prisma.region.findFirst({ where: { id: data.region_id, is_deleted: false, is_active: true } }) : null,
      data.province_id ? prisma.province.findFirst({ where: { id: data.province_id, is_deleted: false, is_active: true } }) : null,
      data.city_id ? prisma.city.findFirst({ where: { id: data.city_id, is_deleted: false, is_active: true } }) : null,
    ]);
    if (data.node_type_id && !type) throw { statusCode: 400, message: 'Type node invalide' };
    if (data.region_id && !region) throw { statusCode: 400, message: 'Région invalide/inactive' };
    if (data.province_id && !province) throw { statusCode: 400, message: 'Province invalide/inactive' };
    if (data.city_id && !city) throw { statusCode: 400, message: 'Ville invalide/inactive' };
    if (region && province && province.region_id !== region.id) {
      throw { statusCode: 400, message: 'La province ne dépend pas de la région sélectionnée' };
    }
    if (province && city && city.province_id !== province.id) {
      throw { statusCode: 400, message: 'La ville ne dépend pas de la province sélectionnée' };
    }
  }

  _mapPayload(data) {
    const payload = { ...data };
    if (payload.lat !== undefined && payload.lat !== '') payload.lat = Number(payload.lat);
    if (payload.lng !== undefined && payload.lng !== '') payload.lng = Number(payload.lng);
    if (payload.delivery_radius_km !== undefined && payload.delivery_radius_km !== '') {
      payload.delivery_radius_km = Number(payload.delivery_radius_km);
    }
    if (payload.max_daily_orders !== undefined && payload.max_daily_orders !== '') {
      payload.max_daily_orders = Number(payload.max_daily_orders);
    }
    if (payload.opening_hours_json && typeof payload.opening_hours_json === 'string') {
      payload.opening_hours_json = JSON.parse(payload.opening_hours_json);
    }
    return payload;
  }

  async create(data) {
    const payload = this._mapPayload(data);
    const exists = await repo.findByCode(payload.code);
    if (exists) throw { statusCode: 409, message: 'Ce code node existe déjà' };
    await this._validateRefs(payload);
    return repo.create(payload);
  }

  async update(id, data) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Node introuvable' };
    const payload = this._mapPayload(data);
    if (payload.code) {
      const exists = await repo.findByCode(payload.code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code node existe déjà' };
    }
    await this._validateRefs({
      node_type_id: payload.node_type_id || item.node_type_id,
      region_id: payload.region_id || item.region_id,
      province_id: payload.province_id || item.province_id,
      city_id: payload.city_id || item.city_id,
    });
    return repo.update(id, payload);
  }

  async delete(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Node introuvable' };
    await repo.softDelete(id);
  }
}

module.exports = new NodeService();
