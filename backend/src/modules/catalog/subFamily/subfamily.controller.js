const service = require('./subfamily.service');
const response = require('../../../utils/response');

class SubfamilyController {
  async index(req, res, next) {
    try {
      if (req.query.all === 'true') return response.success(res, await service.getList(req.query.family_id));
      const result = await service.getAll(req.query);
      return res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }
  async show(req, res, next) {
    try { return response.success(res, await service.getById(req.params.id)); } catch (err) { next(err); }
  }
  async store(req, res, next) {
    try {
      const data = await service.create(req.body);
      return response.success(res, data, 'Sous-famille créée', 201);
    } catch (err) { next(err); }
  }
  async update(req, res, next) {
    try {
      const data = await service.update(req.params.id, req.body);
      return response.success(res, data, 'Sous-famille mise à jour');
    } catch (err) { next(err); }
  }
  async destroy(req, res, next) {
    try { await service.delete(req.params.id); return response.success(res, null, 'Sous-famille supprimée'); }
    catch (err) { next(err); }
  }
  async toggleStatus(req, res, next) {
    try {
      const row = await service.toggleStatus(req.params.id);
      response.success(res, row, 'Statut mis à jour');
    } catch (e) { next(e); }
  }
  async reorder(req, res, next) {
    try {
      const rows = await service.reorder(req.body.items);
      response.success(res, rows, 'Ordre mis à jour');
    } catch (e) { next(e); }
  }
  async restore(req, res, next) {
    try {
      const row = await service.restore(req.params.id);
      response.success(res, row, 'Sous-famille restaurée');
    } catch (e) { next(e); }
  }
}

module.exports = new SubfamilyController();