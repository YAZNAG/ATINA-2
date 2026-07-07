const svc  = require('./customer_claims.service');
const resp = require('../../utils/response');
const E = (res, next, e) => { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); };

class CustomerClaimsController {
  async list(req, res, next) {
    try { resp.success(res, await svc.listMyClaims(req.customerId, req.query)); }
    catch(e) { E(res, next, e); }
  }

  async show(req, res, next) {
    try { resp.success(res, await svc.getMyClaimById(req.customerId, req.params.id)); }
    catch(e) { E(res, next, e); }
  }

  async store(req, res, next) {
    try { resp.success(res, await svc.createClaim(req.customerId, req.body), 'Réclamation soumise', 201); }
    catch(e) { E(res, next, e); }
  }

  async cancel(req, res, next) {
    try { await svc.cancelClaim(req.customerId, req.params.id); resp.success(res, null, 'Réclamation annulée'); }
    catch(e) { E(res, next, e); }
  }

  async types(req, res, next) {
    try {
      const types = svc.VALID_TYPES.map(code => ({
        code, label: svc.TYPE_LABELS[code],
      }));
      resp.success(res, types);
    } catch(e) { E(res, next, e); }
  }
}

module.exports = new CustomerClaimsController();