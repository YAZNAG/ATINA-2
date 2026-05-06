const service = require('./level.service');
const response = require('../../../utils/response');

class LevelController {
  async index(req, res, next) {
    try { return res.json({ success: true, ...(await service.getAll(req.query)) }); } catch (e) { next(e); }
  }
  async show(req, res, next) {
    try { return response.success(res, await service.getById(req.params.id)); } catch (e) { next(e); }
  }
  async store(req, res, next) {
    try { return response.success(res, await service.create(req.body), 'Niveau créé', 201); } catch (e) { next(e); }
  }
  async update(req, res, next) {
    try { return response.success(res, await service.update(req.params.id, req.body), 'Niveau mis à jour'); } catch (e) { next(e); }
  }
  async destroy(req, res, next) {
    try { await service.delete(req.params.id); return response.success(res, null, 'Niveau supprimé'); } catch (e) { next(e); }
  }
}

module.exports = new LevelController();
