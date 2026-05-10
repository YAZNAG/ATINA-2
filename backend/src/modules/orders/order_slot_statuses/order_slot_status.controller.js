const svc  = require('./order_slot_status.service');
const resp = require('../../../utils/response');

class OrderSlotStatusController {
  async index(req, res, next)   { try { res.json({ success: true, ...(await svc.getAll(req.query)) }); } catch(e) { next(e); } }
  async show(req, res, next)    { try { resp.success(res, await svc.getById(req.params.id)); } catch(e) { next(e); } }
  async store(req, res, next)   { try { resp.success(res, await svc.create(req.body), 'Statut créé', 201); } catch(e) { next(e); } }
  async update(req, res, next)  { try { resp.success(res, await svc.update(req.params.id, req.body), 'Statut mis à jour'); } catch(e) { next(e); } }
  async destroy(req, res, next) { try { await svc.delete(req.params.id); resp.success(res, null, 'Statut supprimé'); } catch(e) { next(e); } }
  async seedData(req, res, next){ try { resp.success(res, await svc.seed(), 'Données seedées'); } catch(e) { next(e); } }
}

module.exports = new OrderSlotStatusController();
