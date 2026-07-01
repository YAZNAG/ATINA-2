const svc  = require('./customer_promotions.service');
const resp = require('../../utils/response');
const E    = (res, next, e) => { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); };

class CustomerPromotionsController {
  async list(req, res, next) {
    try { resp.success(res, await svc.listActivePromotions()); }
    catch(e) { E(res, next, e); }
  }

  async detail(req, res, next) {
    try { resp.success(res, await svc.getFlashSaleById(req.params.id)); }
    catch(e) { E(res, next, e); }
  }

  async bestDeals(req, res, next) {
    try {
      const limit = parseInt(req.query.limit, 10) || 10;
      resp.success(res, await svc.listBestDeals(limit));
    } catch(e) { E(res, next, e); }
  }
}

module.exports = new CustomerPromotionsController();
