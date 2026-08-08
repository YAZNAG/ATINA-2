const service = require('./category.service');
const response = require('../../../utils/response');

class CategoryController {
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
    try { return response.success(res, await service.create(req.body, req.files), 'Catégorie créée', 201); } catch (err) { next(err); }
  }
  async update(req, res, next) {
    try { return response.success(res, await service.update(req.params.id, req.body, req.files), 'Catégorie mise à jour'); } catch (err) { next(err); }
  }
  async destroy(req, res, next) {
    try { await service.delete(req.params.id); return response.success(res, null, 'Catégorie supprimée'); } catch (err) { next(err); }
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
    response.success(res, row, 'Catégorie restaurée');
  } catch (e) { next(e); }
}
}

module.exports = new CategoryController();
