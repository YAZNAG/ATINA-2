const svc  = require('./customer_catalog.service');
const resp = require('../../utils/response');
const { subCategory } = require('../../config/database');

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
    const { category_ids, ...rest } = req.query;
    const parsedIds = category_ids
      ? String(category_ids).split(',').map(Number).filter((n) => !Number.isNaN(n))
      : undefined;

    const result = await svc.searchArticles({
      ...rest,
      category_ids: parsedIds,
    });
    res.json({ success: true, ...result });
  } catch(e) { E(res, next, e); }
}

  async cities(req, res, next) {
    try { resp.success(res, await svc.getCities()); }
    catch(e) { E(res, next, e); }
  }


async subCategories(req, res, next){
  try{
    resp.success(res, await svc.getSubCategories(req.params.id));
  }
  catch(e) { E(res, next, e); }
}

  async recommendedArticles(req, res, next) {
    try {
      const customerId = req.customerId; 
      const limit      = req.query.limit ? parseInt(req.query.limit, 10) : 20;

      if (isNaN(limit) || limit < 1 || limit > 100) {
        return resp.error(res, 'Paramètre limit invalide (1–100)', 400);
      }

      resp.success(res, await svc.getRecommendedArticles(customerId, { limit }));
    } catch (e) { E(res, next, e);  }
  }

async popular(req, res, next) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const page  = req.query.page  ? Number(req.query.page)  : 1;
    const days  = req.query.days  ? Number(req.query.days)  : 30;
    resp.success(res, await svc.getPopularArticles({ limit, page, days }));
  } catch (e) { E(res, next, e); }
}

async topRated(req, res, next) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const page  = req.query.page  ? Number(req.query.page)  : 1;
    resp.success(res, await svc.getTopRatedArticles({ limit, page }));
  } catch (e) { E(res, next, e); }
}

async cartComplements(req, res, next) {
  try {
    const skuIds = (req.query.sku_ids || '').split(',').filter(Boolean);
    const limit  = req.query.limit ? Number(req.query.limit) : 10;
    const page   = req.query.page  ? Number(req.query.page)  : 1;
    resp.success(res, await svc.getCartComplements({ skuIds, limit, page }));
  } catch (e) { E(res, next, e); }
}
}
module.exports = new CustomerCatalogController();
