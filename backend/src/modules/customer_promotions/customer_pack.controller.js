const svc  = require('./customer_pack.service');
const resp = require('../../utils/response');
const E = (res, next, e) => { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); };

class CustomerPackController {
  async list(req, res, next) {
    try { resp.success(res, await svc.listActivePacks()); }
    catch(e) { E(res, next, e); }
  }

  async show(req, res, next) {
    try { resp.success(res, await svc.getPackById(req.params.id)); }
    catch(e) { E(res, next, e); }
  }
}

module.exports = new CustomerPackController();