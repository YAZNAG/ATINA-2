const svc  = require('./customer_catalog.service');
const resp = require('../../utils/response');
const { resolveCatalogNode } = require('./customer_node');

const E = (res, next, e) => {
  if (e.statusCode) return resp.error(res, e.message, e.statusCode);
  next(e);
};

// Node du catalogue (prix, vendabilité, stock, flash) — ?node_id=, sinon contexte client, sinon défaut.
const ctxOf = async (req) => ({ node: await resolveCatalogNode(req) });

// Identifiants (UUID) séparés par des virgules.
const idList = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

class CustomerCatalogController {
  async categories(req, res, next) {
    try { resp.success(res, await svc.getCategories(await ctxOf(req))); }
    catch (e) { E(res, next, e); }
  }

  async articlesByCategory(req, res, next) {
    try {
      const result = await svc.getArticlesByCategory(req.params.id, req.query, await ctxOf(req));
      res.json({ success: true, ...result });
    } catch (e) { E(res, next, e); }
  }

  async articleDetail(req, res, next) {
    try { resp.success(res, await svc.getArticleDetail(req.params.id, await ctxOf(req))); }
    catch (e) { E(res, next, e); }
  }

  async searchArticles(req, res, next) {
    try {
      const { category_ids, ...rest } = req.query;
      const result = await svc.searchArticles(
        { ...rest, category_ids: category_ids ? idList(category_ids) : undefined },
        await ctxOf(req),
      );
      res.json({ success: true, ...result });
    } catch (e) { E(res, next, e); }
  }

  async cities(req, res, next) {
    try { resp.success(res, await svc.getCities()); }
    catch (e) { E(res, next, e); }
  }

  async subCategories(req, res, next) {
    try { resp.success(res, await svc.getSubCategories(req.params.id, await ctxOf(req))); }
    catch (e) { E(res, next, e); }
  }

  async recommendedArticles(req, res, next) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return resp.error(res, 'Paramètre limit invalide (1–100)', 400);
      }
      resp.success(res, await svc.getRecommendedArticles(req.customerId, { limit }, await ctxOf(req)));
    } catch (e) { E(res, next, e); }
  }

  async popular(req, res, next) {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const page  = req.query.page  ? Number(req.query.page)  : 1;
      const days  = req.query.days  ? Number(req.query.days)  : 30;
      resp.success(res, await svc.getPopularArticles({ limit, page, days }, await ctxOf(req)));
    } catch (e) { E(res, next, e); }
  }

  async topRated(req, res, next) {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const page  = req.query.page  ? Number(req.query.page)  : 1;
      resp.success(res, await svc.getTopRatedArticles({ limit, page }, await ctxOf(req)));
    } catch (e) { E(res, next, e); }
  }

  async cartComplements(req, res, next) {
    try {
      const skuIds = idList(req.query.sku_ids);
      const limit  = req.query.limit ? Number(req.query.limit) : 10;
      const page   = req.query.page  ? Number(req.query.page)  : 1;
      resp.success(res, await svc.getCartComplements({ skuIds, limit, page }, await ctxOf(req)));
    } catch (e) { E(res, next, e); }
  }
}

module.exports = new CustomerCatalogController();
