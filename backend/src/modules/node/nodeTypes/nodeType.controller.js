const service = require('./nodeType.service');
const response = require('../../../utils/response');

class NodeTypeController {
  async index(req, res, next) {
    try { return response.success(res, await service.getAll()); } catch (err) { next(err); }
  }

  async show(req, res, next) {
    try { return response.success(res, await service.getById(req.params.id)); } catch (err) { next(err); }
  }

  async store(req, res, next) {
    try { return response.success(res, await service.create(req.body), 'Type node créé', 201); } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try { return response.success(res, await service.update(req.params.id, req.body), 'Type node mis à jour'); } catch (err) { next(err); }
  }

  async destroy(req, res, next) {
    try {
      await service.delete(req.params.id);
      return response.success(res, null, 'Type node supprimé');
    } catch (err) { next(err); }
  }
}

module.exports = new NodeTypeController();
