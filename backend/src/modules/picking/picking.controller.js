const svc  = require('./picking.service');
const resp = require('../../utils/response');

const E = (res, next, err) => { if (err.statusCode) return resp.error(res, err.message, err.statusCode); next(err); };

class PickingController {
  async listSessions(req, res, next)  { try { res.json({ success: true, ...(await svc.listSessions(req.query)) }); } catch(e) { E(res,next,e); } }
  async getSession(req, res, next)    { try { resp.success(res, await svc.getSession(req.params.id)); } catch(e) { E(res,next,e); } }
  async createSession(req, res, next) {
    try {
      const { order_id } = req.body;
      if (!order_id) return resp.error(res, 'order_id requis', 400);
      resp.success(res, await svc.createSession(order_id), 'Session créée', 201);
    } catch(e) { E(res,next,e); }
  }
  async startSession(req, res, next)    { try { resp.success(res, await svc.startSession(req.params.id, { ...req.body, changed_by: req.user?.id ?? null }), 'Session démarrée'); } catch(e) { E(res,next,e); } }
  async completeSession(req, res, next) { try { resp.success(res, await svc.completeSession(req.params.id, req.user?.id ?? null), 'Session terminée — commande Prête'); } catch(e) { E(res,next,e); } }
  async cancelSession(req, res, next)   { try { resp.success(res, await svc.cancelSession(req.params.id), 'Session annulée'); } catch(e) { E(res,next,e); } }
  async pickItem(req, res, next)        { try { resp.success(res, await svc.pickItem(req.params.id, req.body), 'Article préparé'); } catch(e) { E(res,next,e); } }
  async substituteItem(req, res, next)  { try { resp.success(res, await svc.substituteItem(req.params.id), 'Article substitué'); } catch(e) { E(res,next,e); } }
  async outOfStock(req, res, next)      { try { resp.success(res, await svc.outOfStock(req.params.id), 'Rupture enregistrée'); } catch(e) { E(res,next,e); } }
  async listPickers(req, res, next)     { try { resp.success(res, await svc.listPickers(req.query.node_id)); } catch(e) { E(res,next,e); } }
  async assignPicker(req, res, next)    {
    try {
      const { picker_id } = req.body;
      if (!picker_id) return resp.error(res, 'picker_id requis', 400);
      resp.success(res, await svc.assignPicker(req.params.id, picker_id), 'Picker affecté');
    } catch(e) { E(res,next,e); }
  }
}

module.exports = new PickingController();
