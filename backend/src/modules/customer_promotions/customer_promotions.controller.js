const svc  = require('./customer_promotions.service');
const resp = require('../../utils/response');
const { resolveCatalogNode } = require('../customer_catalog/customer_node');

const E = (res, next, e) => { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); };

// Node du client (ventes flash rattachées à un node) — ?node_id=, sinon adresse / ville du client.
const ctxOf = async (req) => ({ node: await resolveCatalogNode(req) });

class CustomerPromotionsController {
  async list(req, res, next) {
    try { resp.success(res, await svc.listActivePromotions(await ctxOf(req))); }
    catch (e) { E(res, next, e); }
  }

  async detail(req, res, next) {
    try { resp.success(res, await svc.getFlashSaleById(req.params.id, await ctxOf(req))); }
    catch (e) { E(res, next, e); }
  }

  async bestDeals(req, res, next) {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const page  = req.query.page  ? Number(req.query.page)  : 1;
      resp.success(res, await svc.listBestDeals(limit, [], page, await ctxOf(req)));
    } catch (e) { E(res, next, e); }
  }

  async endingSoon(req, res, next) {
    try {
      const hours = req.query.hours ? Number(req.query.hours) : 24;
      resp.success(res, await svc.listEndingSoon(hours, await ctxOf(req)));
    } catch (e) { E(res, next, e); }
  }

  async homePromotions(req, res, next) {
    try {
      resp.success(res, await svc.listHomePromotions({
        endingSoonHours: req.query.hours ? Number(req.query.hours) : 24,
        bestDealsLimit:  req.query.limit ? Number(req.query.limit) : 10,
      }, await ctxOf(req)));
    } catch (e) { E(res, next, e); }
  }
}

module.exports = new CustomerPromotionsController();
