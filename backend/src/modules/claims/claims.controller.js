const service  = require('./claims.service');
const response = require('../../utils/response');

class ClaimsController {
  async index(req, res, next) {
    try {
      const result = await service.getAll(req.query);
      return res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }

  async show(req, res, next) {
    try { return response.success(res, await service.getById(req.params.id)); }
    catch (err) { next(err); }
  }

  async update(req, res, next) {
    try { return response.success(res, await service.updateStatus(req.params.id, req.body), 'Réclamation mise à jour'); }
    catch (err) { next(err); }
  }
}


module.exports = new ClaimsController();