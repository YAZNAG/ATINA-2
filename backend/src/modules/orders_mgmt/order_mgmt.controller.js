const svc  = require('./order_mgmt.service');
const resp = require('../../utils/response');

const fail = (res, next, e) => (e?.statusCode ? resp.error(res, e.message, e.statusCode) : next(e));

class OrderMgmtController {
  async index(req, res, next) {
    try { res.json({ success: true, message: 'Success', ...(await svc.list(req.query)) }); } catch (e) { fail(res, next, e); }
  }

  async show(req, res, next) {
    try { resp.success(res, await svc.getById(req.params.id)); } catch (e) { fail(res, next, e); }
  }

  async transitions(req, res, next) {
    try { resp.success(res, await svc.getTransitions(req.params.id)); } catch (e) { fail(res, next, e); }
  }

  async changeStatus(req, res, next) {
    try {
      const { status_code } = req.body || {};
      if (!status_code) return resp.error(res, 'status_code requis', 400);
      resp.success(res, await svc.changeStatus(req.params.id, status_code, req), 'Statut mis à jour');
    } catch (e) { fail(res, next, e); }
  }

  async cancelPreview(req, res, next) {
    try { resp.success(res, await svc.cancelPreview(req.params.id)); } catch (e) { fail(res, next, e); }
  }

  async cancel(req, res, next) {
    try { resp.success(res, await svc.cancel(req.params.id, req.body?.reason, req), 'Commande annulée'); } catch (e) { fail(res, next, e); }
  }

  async history(req, res, next) {
    try { resp.success(res, await svc.getHistory(req.params.id)); } catch (e) { fail(res, next, e); }
  }

  async slots(req, res, next) {
    try { resp.success(res, await svc.getSlots(req.params.id, req.query)); } catch (e) { fail(res, next, e); }
  }

  async updateSlot(req, res, next) {
    try {
      const order = await svc.updateSlot(req.params.id, req.body?.slot_id, req);
      resp.success(res, order, order.capacity_warning || 'Créneau de la commande confirmé');
    } catch (e) { fail(res, next, e); }
  }

  async update(req, res, next) {
    try { resp.success(res, await svc.updateOrder(req.params.id, req.body || {}, req), 'Commande mise à jour'); } catch (e) { fail(res, next, e); }
  }

  async updateItem(req, res, next) {
    try { resp.success(res, await svc.updateItem(req.params.id, req.params.itemId, req.body || {}, req), 'Ligne mise à jour'); } catch (e) { fail(res, next, e); }
  }

  async addItem(req, res, next) {
    try { resp.success(res, await svc.addItem(req.params.id, req.body || {}, req), 'Ligne ajoutée', 201); } catch (e) { fail(res, next, e); }
  }

  async substituteItem(req, res, next) {
    try { resp.success(res, await svc.substituteItem(req.params.id, req.params.itemId, req.body || {}, req), 'Ligne substituée'); } catch (e) { fail(res, next, e); }
  }

  async collectPayment(req, res, next) {
    try { resp.success(res, await svc.collectPayment(req.params.id, req.body || {}, req), 'Encaissement enregistré'); } catch (e) { fail(res, next, e); }
  }

  async payments(req, res, next) {
    try { res.json({ success: true, message: 'Success', ...(await svc.listPayments(req.query)) }); } catch (e) { fail(res, next, e); }
  }

  async assignPicker(req, res, next) {
    try {
      const { picker_id } = req.body || {};
      if (!picker_id) return resp.error(res, 'picker_id requis', 400);
      const session = await svc.assignPicker(req.params.id, picker_id, req.user?.id ?? null);
      resp.success(res, session, 'Picker affecté — session picking créée', 201);
    } catch (e) { fail(res, next, e); }
  }

  async confirmPickup(req, res, next) {
    try {
      const order = await svc.confirmPickup(req.params.id, req.body ?? {}, req);
      resp.success(res, order, 'Retrait confirmé — commande clôturée');
    } catch (e) { fail(res, next, e); }
  }

  async pickersForNode(req, res, next) {
    try {
      const order = await svc.getById(req.params.id);
      resp.success(res, await svc.getPickersForNode(order.node?.id ?? order.node_id));
    } catch (e) { fail(res, next, e); }
  }

  async meta(req, res, next) {
    try { resp.success(res, await svc.meta(req.query || {})); } catch (e) { fail(res, next, e); }
  }

  async byNode(req, res, next) {
    try { res.json({ success: true, ...(await svc.list({ ...req.query, node_id: req.params.nodeId })) }); } catch (e) { fail(res, next, e); }
  }

  async byCustomer(req, res, next) {
    try { res.json({ success: true, ...(await svc.list({ ...req.query, customer_id: req.params.custId })) }); } catch (e) { fail(res, next, e); }
  }
}

module.exports = new OrderMgmtController();
