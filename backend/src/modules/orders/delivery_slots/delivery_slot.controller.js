const svc  = require('./delivery_slot.service');
const resp = require('../../../utils/response');

class DeliverySlotController {
  async index(req, res, next)   { try { res.json({ success: true, ...(await svc.getAll(req.query)) }); } catch(e) { next(e); } }
  async show(req, res, next)    { try { resp.success(res, await svc.getById(req.params.id)); } catch(e) { next(e); } }
  async store(req, res, next)   { try { resp.success(res, await svc.create(req.body), 'Créneau créé', 201); } catch(e) { next(e); } }
  async update(req, res, next)  { try { resp.success(res, await svc.update(req.params.id, req.body), 'Créneau mis à jour'); } catch(e) { next(e); } }
  async destroy(req, res, next) { try { await svc.delete(req.params.id); resp.success(res, null, 'Créneau supprimé'); } catch(e) { next(e); } }
}

module.exports = new DeliverySlotController();
