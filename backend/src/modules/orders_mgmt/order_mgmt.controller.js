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
      const changed_by = req.user?.id ?? null;
      resp.success(res, await svc.changeStatus(req.params.id, status_code, changed_by), 'Statut mis à jour');
    } catch(e) { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); }
  }
  async cancel(req, res, next) {
    try {
      const changed_by = req.user?.id ?? null;
      resp.success(res, await svc.cancel(req.params.id, req.body.reason, changed_by), 'Commande annulée');
    } catch(e) { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); }
  }
  async history(req, res, next) {
    try { resp.success(res, await svc.getHistory(req.params.id)); }
    catch(e) { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); }
  }
  async assignPicker(req, res, next) {
    try {
      const { picker_id } = req.body;
      if (!picker_id) return resp.error(res, 'picker_id requis', 400);
      const session = await svc.assignPicker(req.params.id, picker_id, req.user?.id ?? null);
      resp.success(res, session, 'Picker affecté — session picking créée', 201);
    } catch(e) { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); }
  }
  async confirmPickup(req, res, next) {
    try {
      const order = await svc.confirmPickup(req.params.id, req.body ?? {}, req.user?.id ?? null);
      resp.success(res, order, 'Retrait confirmé — commande clôturée');
    } catch(e) { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); }
  }
  async pickersForNode(req, res, next) {
    try {
      const order = await svc.getById(req.params.id);
      const pickers = await svc.getPickersForNode(order.node?.id ?? order.node_id);
      resp.success(res, pickers);
    } catch(e) { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); }
  }
  async meta(req, res, next) {
    try { resp.success(res, await svc.meta()); } catch(e) { next(e); }
  }
}

module.exports = new OrderMgmtController();
