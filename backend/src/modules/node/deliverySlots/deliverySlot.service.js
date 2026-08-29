const prisma = require('../../../config/database');
const repo = require('./deliverySlot.repository');

const toDateOnly = (dateStr) => new Date(`${dateStr}T00:00:00.000Z`);

class DeliverySlotService {
  // Créneaux d'une date précise, avec le compteur de réservations
  async getByDate(nodeId, dateStr) {
    const node = await prisma.node.findFirst({ where: { id: nodeId, is_deleted: false } });
    if (!node) throw { statusCode: 404, message: 'Node introuvable' };

    const date = toDateOnly(dateStr);
    const slots = await repo.findByNodeAndDate(nodeId, date);

    return {
      node: { id: node.id, name: node.name_fr },
      date: dateStr,
      slots: slots.map((s) => ({
        id: s.id,
        start: s.slot_start,
        end: s.slot_end,
        max_orders: s.max_orders,
        reservations: s._count.orders_confirmed,
        is_active: s.is_active,
      })),
    };
  }

    // Aperçu calendrier : créneaux du mois groupés par jour (horaires + statut)
  async getMonthOverview(nodeId, year, month) {
    const node = await prisma.node.findFirst({ where: { id: nodeId, is_deleted: false } });
    if (!node) throw { statusCode: 404, message: 'Node introuvable' };

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    const slots = await repo.findMonthOverview(nodeId, start, end);

    const days = {};
    for (const s of slots) {
      const key = s.specific_date.toISOString().slice(0, 10);
      if (!days[key]) days[key] = [];
      days[key].push({ start: s.slot_start, end: s.slot_end, is_active: s.is_active });
    }

    return { node: { id: node.id, name: node.name_fr }, year, month, days };
  }

  async create(nodeId, data) {
    const node = await prisma.node.findFirst({ where: { id: nodeId, is_deleted: false } });
    if (!node) throw { statusCode: 404, message: 'Node introuvable' };
    return repo.create({
      node_id: nodeId,
      specific_date: toDateOnly(data.specific_date),
      slot_start: data.slot_start,
      slot_end: data.slot_end,
      max_orders: data.max_orders,
      is_active: data.is_active ?? true,
    });
  }

  async update(id, data) {
    const slot = await repo.findById(id);
    if (!slot) throw { statusCode: 404, message: 'Créneau introuvable' };
    return repo.update(id, data);
  }

  async delete(id) {
    const slot = await repo.findById(id);
    if (!slot) throw { statusCode: 404, message: 'Créneau introuvable' };
    await repo.remove(id);
  }
}

module.exports = new DeliverySlotService();