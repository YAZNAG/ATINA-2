const service = require('./province.service');
const response = require('../../../utils/response');

class ProvinceController {
  async index(req, res, next) {
    try {
      const result = await service.getAll(req.query);
      return res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }

  async store(req, res, next) {
    try { return response.success(res, await service.create(req.body), 'Province créée', 201); } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try { return response.success(res, await service.update(req.params.id, req.body), 'Province mise à jour'); } catch (err) { next(err); }
  }
}

module.exports = new ProvinceController();
