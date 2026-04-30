const prisma = require('../../../config/database');
const repo = require('./deliverySlot.repository');

class DeliverySlotService {
  async getByNode(nodeId) {
    const node = await prisma.node.findFirst({ where: { id: nodeId, is_deleted: false } });
    if (!node) throw { statusCode: 404, message: 'Node introuvable' };
    return repo.findByNode(nodeId);
  }

  async create(nodeId, data) {
    const node = await prisma.node.findFirst({ where: { id: nodeId, is_deleted: false } });
    if (!node) throw { statusCode: 404, message: 'Node introuvable' };
    return repo.create({ ...data, node_id: nodeId });
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
