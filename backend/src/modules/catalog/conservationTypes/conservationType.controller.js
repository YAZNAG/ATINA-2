const service = require('./conservationType.service');
const response = require('../../../utils/response');

class ConservationTypeController {
  async index(req, res, next) {
    try {
      if (req.query.all === 'true') return response.success(res, await service.getList());
      const result = await service.getAll(req.query);
      return res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }
  async show(req, res, next) {
    try { return response.success(res, await service.getById(req.params.id)); } catch (err) { next(err); }
  }
  async store(req, res, next) {
    try { return response.success(res, await service.create(req.body), 'Type de conservation créé', 201); } catch (err) { next(err); }
  }
  async update(req, res, next) {
    try { return response.success(res, await service.update(req.params.id, req.body), 'Type de conservation mis à jour'); } catch (err) { next(err); }
  }
  async destroy(req, res, next) {
    try { await service.delete(req.params.id); return response.success(res, null, 'Type de conservation supprimé'); } catch (err) { next(err); }
  }
}

module.exports = new ConservationTypeController();
