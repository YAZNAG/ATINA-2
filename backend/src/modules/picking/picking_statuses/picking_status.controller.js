const svc = require('./picking_status.service');
const resp = require('../../../utils/response');
const E = (res, next, e) => { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); };

class PickingStatusController {
  async index(req, res, next)   { try { res.json({ success:true, ...(await svc.getAll(req.query)) }); }    catch(e){E(res,next,e);} }
  async show(req, res, next)    { try { resp.success(res, await svc.getById(req.params.id)); }               catch(e){E(res,next,e);} }
  async store(req, res, next)   { try { resp.success(res, await svc.create(req.body), 'Statut créé', 201); } catch(e){E(res,next,e);} }
  async update(req, res, next)  { try { resp.success(res, await svc.update(req.params.id, req.body), 'Statut mis à jour'); } catch(e){E(res,next,e);} }
  async destroy(req, res, next) { try { await svc.delete(req.params.id); resp.success(res, null, 'Statut supprimé'); } catch(e){E(res,next,e);} }
  async seedData(req, res, next){ try { resp.success(res, await svc.seed(), 'Données seedées'); } catch(e){E(res,next,e);} }
}
module.exports = new PickingStatusController();
