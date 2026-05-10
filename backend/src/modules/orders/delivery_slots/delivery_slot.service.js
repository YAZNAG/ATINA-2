const repo = require('./delivery_slot.repository');

class DeliverySlotService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1, limit = Number(params.limit) || 100;
    if (params.all === 'true') return { data };
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Créneau introuvable' };
    return item;
  }

  async create(data) {
    const { node_id, name_fr, name_ar, day_of_week, slot_start, slot_end, max_orders, is_active } = data;
    if (!node_id)                      throw { statusCode: 400, message: 'node_id requis' };
    if (!name_fr?.trim())              throw { statusCode: 400, message: 'Nom (FR) requis' };
    if (!name_ar?.trim())              throw { statusCode: 400, message: 'Nom (AR) requis' };
    if (day_of_week === undefined)     throw { statusCode: 400, message: 'Jour de la semaine requis' };
    if (!slot_start?.trim())           throw { statusCode: 400, message: 'Heure de début requise' };
    if (!slot_end?.trim())             throw { statusCode: 400, message: 'Heure de fin requise' };
    return repo.create({
      node_id, name_fr: name_fr.trim(), name_ar: name_ar.trim(),
      day_of_week: parseInt(day_of_week), slot_start, slot_end,
      max_orders: max_orders ? parseInt(max_orders) : null,
      is_active: is_active !== false && is_active !== 'false',
    });
  }

  async update(id, data) {
    if (!await repo.findById(id)) throw { statusCode: 404, message: 'Créneau introuvable' };
    const p = {};
    if (data.name_fr !== undefined)    p.name_fr = data.name_fr.trim();
    if (data.name_ar !== undefined)    p.name_ar = data.name_ar.trim();
    if (data.day_of_week !== undefined) p.day_of_week = parseInt(data.day_of_week);
    if (data.slot_start !== undefined) p.slot_start = data.slot_start;
    if (data.slot_end !== undefined)   p.slot_end   = data.slot_end;
    if (data.max_orders !== undefined) p.max_orders = data.max_orders ? parseInt(data.max_orders) : null;
    if (data.is_active !== undefined)  p.is_active  = data.is_active === true || data.is_active === 'true';
    return repo.update(id, p);
  }

  async delete(id) {
    if (!await repo.findById(id)) throw { statusCode: 404, message: 'Créneau introuvable' };
    const used = await repo.countUsage(id);
    if (used > 0) throw { statusCode: 409, message: `Ce créneau est utilisé par ${used} commande(s)` };
    await repo.remove(id);
  }
}

module.exports = new DeliverySlotService();
