const svc  = require('./support.service');
const resp = require('../../utils/response');
const E = (res, next, e) => { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); };

class SupportController {
  async index(req, res, next) {
    try { resp.success(res, await svc.listConversations(req.query)); }
    catch (e) { E(res, next, e); }
  }

  async show(req, res, next) {
    try { resp.success(res, await svc.getConversation(req.params.id)); }
    catch (e) { E(res, next, e); }
  }

  async assign(req, res, next) {
    try { resp.success(res, await svc.assignAgent(req.params.id, req.body.agent_id), 'Agent assigné'); }
    catch (e) { E(res, next, e); }
  }

  async updateStatus(req, res, next) {
    try { resp.success(res, await svc.changeStatus(req.params.id, req.body.status), 'Statut mis à jour'); }
    catch (e) { E(res, next, e); }
  }

  async storeMessage(req, res, next) {
    try {
      const sender_id = req.user?.id ?? null;
      const data = { ...req.body, sender_id };
      resp.success(res, await svc.sendMessage(req.params.id, data), 'Message envoyé', 201);
    } catch (e) { E(res, next, e); }
  }
}

module.exports = new SupportController();
