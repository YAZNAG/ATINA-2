const svc  = require('./customer_catalog.service');
const resp = require('../../utils/response');

const E = (res, next, e) => {
  if (e.statusCode) return resp.error(res, e.message, e.statusCode);
  next(e);
};

class CustomerCatalogController {
  async categories(req, res, next) {
    try { resp.success(res, await svc.getCategories()); }
    catch(e) { E(res, next, e); }
  }

  async articlesByCategory(req, res, next) {
    try {
      const result = await svc.getArticlesByCategory(req.params.id, req.query);
      res.json({ success: true, ...result });
    } catch(e) { E(res, next, e); }
  }

  async articleDetail(req, res, next) {
    try { resp.success(res, await svc.getArticleDetail(req.params.id)); }
    catch(e) { E(res, next, e); }
  }

  async searchArticles(req, res, next) {
    try {
      const result = await svc.searchArticles(req.query);
      res.json({ success: true, ...result });
    } catch(e) { E(res, next, e); }
  }
}

module.exports = new CustomerCatalogController();
