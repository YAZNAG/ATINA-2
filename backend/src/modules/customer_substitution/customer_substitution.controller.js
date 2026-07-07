const svc  = require('./customer_substitution.service');
const resp = require('../../utils/response');

class CustomerSubstitutionController {

  // GET /customer/orders/:orderId/substitutions
  async getOrderSubstitutions(req, res, next) {
    try {
      const { orderId } = req.params;
      const result = await svc.getOrderSubstitutions(req.customerId, orderId);
      return resp.success(res, result);
    } catch (e) { next(e); }
  }

  // GET /customer/substitutions/pending
  async getPending(req, res, next) {
    try {
      const result = await svc.getPendingForCustomer(req.customerId);
      return resp.success(res, result);
    } catch (e) { next(e); }
  }

  // PATCH /customer/substitutions/:sessionItemId/respond
  async respond(req, res, next) {
    try {
      const { sessionItemId } = req.params;
      const { status } = req.body;
      if (!status) return resp.error(res, 'status requis (accepted | refused)', 400);

      const result = await svc.respond(req.customerId, sessionItemId, status);

      const msg = status === 'accepted'
        ? 'Substitution acceptée, commande mise à jour'
        : 'Substitution refusée, article retiré de la commande';

      return resp.success(res, result, msg);
    } catch (e) { next(e); }
  }
}

module.exports = new CustomerSubstitutionController();