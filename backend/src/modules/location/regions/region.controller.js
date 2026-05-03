const service = require('./region.service');
const response = require('../../../utils/response');

class RegionController {
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
    try {
      return response.success(res, await service.create(req.body, req.user.id), 'Région créée', 201);
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      return response.success(res, await service.update(req.params.id, req.body, req.user.id), 'Région mise à jour');
    } catch (err) { next(err); }
  }

  async destroy(req, res, next) {
    try {
      await service.delete(req.params.id, req.user.id);
      return response.success(res, null, 'Région supprimée');
    } catch (err) { next(err); }
  }
}

module.exports = new RegionController();
