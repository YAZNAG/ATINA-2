const svc = require('./quality.service');
const response = require('../../utils/response');
const { audit } = require('../../utils/audit');

class QualityController {
  async index(req, res, next) {
    try {
      const { data, pagination } = await svc.list(req.query);
      res.json({ success: true, message: 'Success', data, pagination });
    } catch (err) { next(err); }
  }

  async exportRows(req, res, next) {
    try { response.success(res, await svc.exportRows(req.query)); } catch (err) { next(err); }
  }

  async stats(req, res, next) {
    try { response.success(res, await svc.stats(req.query)); } catch (err) { next(err); }
  }

  async lookups(req, res, next) {
    try { response.success(res, await svc.lookups()); } catch (err) { next(err); }
  }

  async sessionsLookup(req, res, next) {
    try { response.success(res, await svc.sessionsLookup(req.query)); } catch (err) { next(err); }
  }

  async show(req, res, next) {
    try { response.success(res, await svc.getById(req.params.id)); } catch (err) { next(err); }
  }

  async store(req, res, next) {
    try {
      const created = await svc.create(req.body, req.user?.id ?? null);
      await audit(req, {
        action: 'CREATE',
        resource: 'quality_checks',
        resource_id: created.id,
        new_values: {
          node_id: created.node_id,
          check_type: created.check_type?.code,
          picking_session_id: created.picking_session_id,
          order_id: created.order_id,
          result: created.result,
          score: created.score,
          anomalies: created.anomalies,
        },
      });
      response.success(res, created, 'Contrôle qualité enregistré', 201);
    } catch (err) { next(err); }
  }
}

module.exports = new QualityController();
