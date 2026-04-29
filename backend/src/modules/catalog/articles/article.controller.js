const service = require('./article.service');
const response = require('../../../utils/response');

class ArticleController {
  async index(req, res, next) {
    try {
      const result = await service.getAll(req.query);
      return res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }
  async show(req, res, next) {
    try { return response.success(res, await service.getById(req.params.id)); } catch (err) { next(err); }
  }
  async store(req, res, next) {
    try { return response.success(res, await service.create(req.body, req.files), 'Article créé', 201); } catch (err) { next(err); }
  }
  async update(req, res, next) {
    try { return response.success(res, await service.update(req.params.id, req.body, req.files), 'Article mis à jour'); } catch (err) { next(err); }
  }
  async destroy(req, res, next) {
    try { await service.delete(req.params.id); return response.success(res, null, 'Article supprimé'); } catch (err) { next(err); }
  }
}

module.exports = new ArticleController();
