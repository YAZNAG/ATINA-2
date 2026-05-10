const svc  = require('./order_mgmt.service');
const resp = require('../../utils/response');

class OrderMgmtController {
  async index(req, res, next) {
    try { res.json({ success: true, ...(await svc.list(req.query)) }); } catch(e) { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); }
  }
  async show(req, res, next) {
    try { resp.success(res, await svc.getById(req.params.id)); } catch(e) { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); }
  }
  async transitions(req, res, next) {
    try { resp.success(res, await svc.getTransitions(req.params.id)); } catch(e) { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); }
  }
  async changeStatus(req, res, next) {
    try {
      const { status_code } = req.body;
      if (!status_code) return resp.error(res, 'status_code requis', 400);
      resp.success(res, await svc.changeStatus(req.params.id, status_code), 'Statut mis à jour');
    } catch(e) { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); }
  }
  async cancel(req, res, next) {
    try { resp.success(res, await svc.cancel(req.params.id, req.body.reason), 'Commande annulée'); }
    catch(e) { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); }
  }
  async meta(req, res, next) {
    try { resp.success(res, await svc.meta()); } catch(e) { next(e); }
  }
}

module.exports = new OrderMgmtController();
