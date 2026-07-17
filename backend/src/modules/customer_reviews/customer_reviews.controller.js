const svc  = require('./customer_reviews.service');
const resp = require('../../utils/response');
const E = (res, next, e) => { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); };

class CustomerReviewsController {

  async listByArticle(req, res, next) {
  try {
    resp.success(res, await svc.listByArticle(req.params.article_id, req.query, req.customerId ?? null));
  } catch(e) { E(res, next, e); }
}

  async getMyReview(req, res, next) {
    try { resp.success(res, await svc.getMyReview(req.customerId, req.params.article_id)); }
    catch(e) { E(res, next, e); }
  }

  async create(req, res, next) {
    try { resp.success(res, await svc.createReview(req.customerId, req.params.article_id, req.body), 'Avis ajouté', 201); }
    catch(e) { E(res, next, e); }
  }

  async update(req, res, next) {
    try { resp.success(res, await svc.updateReview(req.customerId, req.params.id, req.body), 'Avis mis à jour'); }
    catch(e) { E(res, next, e); }
  }

  async destroy(req, res, next) {
    try { await svc.deleteReview(req.customerId, req.params.id); resp.success(res, null, 'Avis supprimé'); }
    catch(e) { E(res, next, e); }
  }

  async toggleHelpful(req, res, next) {
  try { resp.success(res, await svc.toggleHelpful(req.customerId, req.params.id), 'Vote mis à jour'); }
  catch(e) { E(res, next, e); }
}


}

module.exports = new CustomerReviewsController();