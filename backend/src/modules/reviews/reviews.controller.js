const service  = require('./reviews.service');
const response = require('../../utils/response');

class ReviewsController {
  async index(req, res, next) {
    try {
      const result = await service.getAll(req.query);
      return res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }

  async destroy(req, res, next) {
    try { await service.remove(req.params.id); return response.success(res, null, 'Avis supprimé'); }
    catch (err) { next(err); }
  }
}

module.exports = new ReviewsController();