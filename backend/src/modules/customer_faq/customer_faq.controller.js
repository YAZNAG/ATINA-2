const svc  = require('./customer_faq.service');
const resp = require('../../utils/response');
const E = (res, next, e) => { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); };

class CustomerFaqController {
  async list(req, res, next) {
    try { resp.success(res, await svc.getFaq()); }
    catch(e) { E(res, next, e); }
  }
}

module.exports = new CustomerFaqController();