const svc  = require('./customer_coupons.service');
const resp = require('../../utils/response');
const E = (res, next, e) => { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); };

class CustomerCouponsController {
  async validate(req, res, next) {
    try {
      const { code, subtotal, delivery_fee } = req.body;
      const result = await svc.validateCode(code, req.customerId, subtotal ?? 0, delivery_fee ?? 0);
      resp.success(res, result);
    } catch(e) { E(res, next, e); }
  }

  async list(req, res, next) {
    try { resp.success(res, await svc.listMyCoupons(req.customerId)); }
    catch(e) { E(res, next, e); }
  }
}

module.exports = new CustomerCouponsController();