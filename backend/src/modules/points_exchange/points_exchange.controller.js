const service  = require('./points_exchange.service');
const response = require('../../utils/response');

function handle(err, res, next) {
  if (err && err.statusCode && err.details) {
    return res.status(err.statusCode).json({ success: false, message: err.message, data: err.details });
  }
  return next(err);
}

class PointsExchangeController {
  async index(req, res, next) {
    try {
      const { data, pagination } = await service.list(req.query);
      return res.json({ success: true, message: 'Success', data, pagination });
    } catch (err) { handle(err, res, next); }
  }

  async show(req, res, next) {
    try { return response.success(res, await service.getById(req.params.id)); }
    catch (err) { handle(err, res, next); }
  }

  async eligibleSkus(req, res, next) {
    try { return response.success(res, await service.eligibleSkus(req.query)); }
    catch (err) { handle(err, res, next); }
  }

  async exchanges(req, res, next) {
    try {
      const { data, summary, pagination } = await service.exchanges(req.query);
      return res.json({ success: true, message: 'Success', data, summary, pagination });
    } catch (err) { handle(err, res, next); }
  }

  async store(req, res, next) {
    try { return response.success(res, await service.create(req.body, req), 'Règle d\'échange créée', 201); }
    catch (err) { handle(err, res, next); }
  }

  async update(req, res, next) {
    try { return response.success(res, await service.update(req.params.id, req.body, req), 'Règle d\'échange mise à jour'); }
    catch (err) { handle(err, res, next); }
  }

  async activate(req, res, next) {
    try { return response.success(res, await service.setActive(req.params.id, true, req), 'Règle activée'); }
    catch (err) { handle(err, res, next); }
  }

  async deactivate(req, res, next) {
    try { return response.success(res, await service.setActive(req.params.id, false, req), 'Règle désactivée'); }
    catch (err) { handle(err, res, next); }
  }

  async duplicate(req, res, next) {
    try {
      const result = await service.duplicate(req.params.id, req.body, req);
      const msg = result.skipped.length
        ? `${result.created.length} règle(s) créée(s), ${result.skipped.length} node(s) ignoré(s)`
        : `${result.created.length} règle(s) créée(s)`;
      return response.success(res, result, msg, 201);
    } catch (err) { handle(err, res, next); }
  }

  async destroy(req, res, next) {
    try { await service.remove(req.params.id, req); return response.success(res, null, 'Règle d\'échange supprimée'); }
    catch (err) { handle(err, res, next); }
  }
}

module.exports = new PointsExchangeController();
