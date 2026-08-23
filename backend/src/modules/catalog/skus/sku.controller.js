const service = require('./sku.service');
const response = require('../../../utils/response');

class SkuController {
  async index(req, res, next) {
    try {
      const result = await service.getAll(req.query);
      return res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async show(req, res, next) {
    try {
      return response.success(res, await service.getById(req.params.id));
    } catch (err) {
      next(err);
    }
  }

  async store(req, res, next) {
    try {
      return response.success(res, await service.create(req.body), 'SKU créé', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      return response.success(res, await service.update(req.params.id, req.body), 'SKU mis à jour');
    } catch (err) {
      next(err);
    }
  }

  async destroy(req, res, next) {
    try {
      await service.delete(req.params.id);
      return response.success(res, null, 'SKU supprimé');
    } catch (err) {
      next(err);
    }
  }

  async toggleStatus(req, res, next) {
    try {
      const row = await service.toggleStatus(req.params.id);
      response.success(res, row, 'Statut mis à jour');
    } catch (e) { next(e); }
  }

  async restore(req, res, next) {
    try {
      const row = await service.restore(req.params.id);
      response.success(res, row, 'SKU restauré');
    } catch (e) { next(e); }
  }
}

module.exports = new SkuController();