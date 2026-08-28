const prisma = require('../../../config/database');
const repo = require('./deliverySlot.repository');

const toDateKey = (date) => date.toISOString().slice(0, 10);

class DeliverySlotService {
  async getByNode(nodeId) {
    const node = await prisma.node.findFirst({ where: { id: nodeId, is_deleted: false } });
    if (!node) throw { statusCode: 404, message: 'Node introuvable' };
    return repo.findByNode(nodeId);
  }

  // Vue calendrier pour un mois donné : fusionne le template récurrent
  // avec les exceptions ponctuelles (une exception sur une date remplace
  // entièrement ce que le récurrent aurait donné pour ce jour-là).
  async getCalendarForMonth(nodeId, year, month) {
    const node = await prisma.node.findFirst({ where: { id: nodeId, is_deleted: false } });
    if (!node) throw { statusCode: 404, message: 'Node introuvable' };

    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const [recurringSlots, exceptions] = await Promise.all([
      repo.findRecurringByNode(nodeId),
      repo.findExceptionsByNodeAndRange(nodeId, startOfMonth, endOfMonth),
    ]);

    const recurringByDow = {};
    for (const slot of recurringSlots) {
      if (!recurringByDow[slot.day_of_week]) recurringByDow[slot.day_of_week] = [];
      recurringByDow[slot.day_of_week].push(slot);
    }

    const exceptionsByDate = {};
    for (const ex of exceptions) {
      const key = toDateKey(ex.specific_date);
      if (!exceptionsByDate[key]) exceptionsByDate[key] = [];
      exceptionsByDate[key].push(ex);
    }

    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const days = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(Date.UTC(year, month - 1, d));
      const key = toDateKey(date);
      const dow = date.getUTCDay();

      if (exceptionsByDate[key]) {
        const dayExceptions = exceptionsByDate[key];
        const isClosed = dayExceptions.some((e) => e.is_closed);
        days.push({
          date: key,
          source: 'exception',
          isClosed,
          slots: isClosed
            ? []
            : dayExceptions.map((e) => ({
                id: e.id,
                start: e.slot_start,
                end: e.slot_end,
                name_fr: e.name_fr,
                name_ar: e.name_ar,
                max_orders: e.max_orders,
              })),
        });
      } else {
        const dayRecurring = recurringByDow[dow] || [];
        days.push({
          date: key,
          source: 'recurring',
          isClosed: false,
          slots: dayRecurring
            .filter((s) => s.is_active)
            .map((s) => ({
              id: s.id,
              start: s.slot_start,
              end: s.slot_end,
              name_fr: s.name_fr,
              name_ar: s.name_ar,
              max_orders: s.max_orders,
            })),
        });
      }
    }

    return { node: { id: node.id, name: node.name_fr }, year, month, days };
  }

  // Créneau récurrent (template hebdomadaire)
  async create(nodeId, data) {
    const node = await prisma.node.findFirst({ where: { id: nodeId, is_deleted: false } });
    if (!node) throw { statusCode: 404, message: 'Node introuvable' };
    return repo.create({ ...data, node_id: nodeId, specific_date: null });
  }

  // Exception ponctuelle pour une date précise (créneau spécifique ou fermeture)
  async createException(nodeId, data) {
    const node = await prisma.node.findFirst({ where: { id: nodeId, is_deleted: false } });
    if (!node) throw { statusCode: 404, message: 'Node introuvable' };
    const isClosed = !!data.is_closed;
    return repo.create({
      node_id: nodeId,
      day_of_week: null,
      specific_date: new Date(data.specific_date),
      slot_start: isClosed ? null : data.slot_start,
      slot_end: isClosed ? null : data.slot_end,
      name_fr: isClosed ? null : data.name_fr,
      name_ar: isClosed ? null : data.name_ar,
      max_orders: isClosed ? null : data.max_orders,
      is_closed: isClosed,
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