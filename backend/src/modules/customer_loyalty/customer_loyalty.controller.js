const svc  = require('./customer_loyalty.service');
const resp = require('../../utils/response');

class CustomerLoyaltyController {

  async getSummary(req, res, next) {
    try {
      const data = await svc.getSummary(req.customerId);
      resp.success(res, data);
    } catch (e) {
      e.statusCode ? resp.error(res, e.message, e.statusCode) : next(e);
    }
  }

  async getHistory(req, res, next) {
    try {
      const limit  = Math.min(50, Number(req.query.limit) || 20);
      const cursor = req.query.cursor || null;
      const data   = await svc.getHistory(req.customerId, limit, cursor);
      resp.success(res, data);
    } catch (e) {
      e.statusCode ? resp.error(res, e.message, e.statusCode) : next(e);
    }
  }

  async redeem(req, res, next) {
  try {
    const data = await svc.redeem(req.customerId);
    resp.success(res, data);
  } catch (e) {
    console.error('[loyalty.redeem] ERROR:', e);
    e.statusCode ? resp.error(res, e.message, e.statusCode) : next(e);
  }
}
}

module.exports = new CustomerLoyaltyController();