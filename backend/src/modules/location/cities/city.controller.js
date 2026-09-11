const service = require('./city.service');
const response = require('../../../utils/response');

class CityController {
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
    try { return response.success(res, await service.create(req.body, req), 'Ville créée', 201); } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try { return response.success(res, await service.update(req.params.id, req.body, req), 'Ville mise à jour'); } catch (err) { next(err); }
  }

  async move(req, res, next) {
    try {
      return response.success(res, await service.move(req.params.id, req.body?.region_id, req), 'Ville rattachée à la nouvelle région');
    } catch (err) { next(err); }
  }

  async reorder(req, res, next) {
    try {
      return response.success(res, await service.reorder(req.params.id, req.body?.direction, req), 'Ordre des villes mis à jour');
    } catch (err) { next(err); }
  }

  async destroy(req, res, next) {
    try {
      await service.delete(req.params.id, req);
      return response.success(res, null, 'Ville supprimée');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CityController();
