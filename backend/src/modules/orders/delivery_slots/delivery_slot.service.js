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
    const { node_id, specific_date, slot_start, slot_end, max_orders, is_active } = data;
    if (!node_id)              throw { statusCode: 400, message: 'node_id requis' };
    if (!specific_date)        throw { statusCode: 400, message: 'Date requise (YYYY-MM-DD)' };
    if (!slot_start?.trim())   throw { statusCode: 400, message: 'Heure de début requise' };
    if (!slot_end?.trim())     throw { statusCode: 400, message: 'Heure de fin requise' };
    if (max_orders === undefined || max_orders === null || max_orders === '')
      throw { statusCode: 400, message: 'Capacité max requise' };

    return repo.create({
      node_id,
      specific_date: new Date(`${specific_date}T00:00:00.000Z`),
      slot_start,
      slot_end,
      max_orders: parseInt(max_orders),
      is_active: is_active !== false && is_active !== 'false',
    });
  }

  async update(id, data) {
    if (!await repo.findById(id)) throw { statusCode: 404, message: 'Créneau introuvable' };
    const p = {};
    if (data.specific_date !== undefined) p.specific_date = new Date(`${data.specific_date}T00:00:00.000Z`);
    if (data.slot_start !== undefined)    p.slot_start = data.slot_start;
    if (data.slot_end !== undefined)      p.slot_end   = data.slot_end;
    if (data.max_orders !== undefined)    p.max_orders = data.max_orders ? parseInt(data.max_orders) : null;
    if (data.is_active !== undefined)     p.is_active  = data.is_active === true || data.is_active === 'true';
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