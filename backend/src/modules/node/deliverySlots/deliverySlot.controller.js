const service = require('./deliverySlot.service');
const response = require('../../../utils/response');

class DeliverySlotController {
  async listByNode(req, res, next) {
    try { return response.success(res, await service.getByNode(req.params.id)); } catch (err) { next(err); }
  }

  async storeByNode(req, res, next) {
    try { return response.success(res, await service.create(req.params.id, req.body), 'Créneau créé', 201); } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try { return response.success(res, await service.update(req.params.id, req.body), 'Créneau mis à jour'); } catch (err) { next(err); }
  }

  async destroy(req, res, next) {
    try { await service.delete(req.params.id); return response.success(res, null, 'Créneau supprimé'); } catch (err) { next(err); }
  }
}

module.exports = new DeliverySlotController();
