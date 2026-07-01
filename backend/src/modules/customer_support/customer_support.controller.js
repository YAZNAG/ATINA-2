const svc  = require('./customer_support.service');
const resp = require('../../utils/response');
const E = (res, next, e) => { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); };

class CustomerSupportController {
  async index(req, res, next) {
    try { resp.success(res, await svc.listMyConversations(req.customerId)); }
    catch (e) { E(res, next, e); }
  }

  async store(req, res, next) {
    try { resp.success(res, await svc.createConversation(req.customerId, req.body), 'Conversation créée', 201); }
    catch (e) { E(res, next, e); }
  }

  async show(req, res, next) {
    try { resp.success(res, await svc.getMyConversation(req.customerId, req.params.id)); }
    catch (e) { E(res, next, e); }
  }

  async storeMessage(req, res, next) {
    try { resp.success(res, await svc.sendMessage(req.customerId, req.params.id, req.body), 'Message envoyé', 201); }
    catch (e) { E(res, next, e); }
  }
}

module.exports = new CustomerSupportController();
