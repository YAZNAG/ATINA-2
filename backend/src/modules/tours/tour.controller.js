const svc  = require('./tour.service');
const resp = require('../../utils/response');
const E = (res, next, e) => e.statusCode ? resp.error(res, e.message, e.statusCode) : next(e);

class TourController {
  async meta(req, res, next) {
    try { resp.success(res, await svc.getMeta()); } catch(e) { E(res, next, e); }
  }

  async index(req, res, next) {
    try { resp.success(res, await svc.listTours(req.query)); } catch(e) { E(res, next, e); }
  }

  async show(req, res, next) {
    try { resp.success(res, await svc.getTour(req.params.id)); } catch(e) { E(res, next, e); }
  }

  async readyOrders(req, res, next) {
    try { resp.success(res, await svc.getReadyHomeOrders(req.query.node_id)); } catch(e) { E(res, next, e); }
  }

  async create(req, res, next) {
    try { resp.success(res, await svc.createTour(req.body), 'Tournée créée', 201); } catch(e) { E(res, next, e); }
  }

  async addOrders(req, res, next) {
    try {
      const { order_ids } = req.body;
      if (!Array.isArray(order_ids) || !order_ids.length)
        return resp.error(res, 'order_ids requis (tableau)', 400);
      resp.success(res, await svc.addOrdersToTour(req.params.id, order_ids));
    } catch(e) { E(res, next, e); }
  }

  async removeStop(req, res, next) {
    try { resp.success(res, await svc.removeStop(req.params.stopId)); } catch(e) { E(res, next, e); }
  }

  async start(req, res, next) {
    try { resp.success(res, await svc.startTour(req.params.id, req.body.changed_by)); } catch(e) { E(res, next, e); }
  }

  async deliverStop(req, res, next) {
    try { resp.success(res, await svc.deliverStop(req.params.stopId, req.body, req.body.changed_by)); } catch(e) { E(res, next, e); }
  }

  async failStop(req, res, next) {
    try { resp.success(res, await svc.failStop(req.params.stopId, req.body, req.body.changed_by)); } catch(e) { E(res, next, e); }
  }

  async complete(req, res, next) {
    try { resp.success(res, await svc.completeTour(req.params.id, req.body.changed_by)); } catch(e) { E(res, next, e); }
  }
}

module.exports = new TourController();
