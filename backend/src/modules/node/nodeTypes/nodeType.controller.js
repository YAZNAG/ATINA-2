const service = require('./nodeType.service');
const response = require('../../../utils/response');

class NodeTypeController {
  async index(req, res, next) {
    try { return response.success(res, await service.getAll()); } catch (err) { next(err); }
  }

  async store(req, res, next) {
    try { return response.success(res, await service.create(req.body), 'Type node créé', 201); } catch (err) { next(err); }
  }
}

module.exports = new NodeTypeController();
