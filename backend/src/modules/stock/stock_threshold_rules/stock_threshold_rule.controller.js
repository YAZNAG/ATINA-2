const service  = require('./stock_threshold_rule.service');
const response = require('../../../utils/response');

class StockThresholdController {
  async byNode(req, res, next) {
    try {
      const data = await service.getByNode(req.query.node_id);
      return res.json({ success: true, data });
    } catch (e) { next(e); }
  }

  async store(req, res, next) {
    try { return response.success(res, await service.create(req.body), 'Règle créée', 201); } catch (e) { next(e); }
  }

  async update(req, res, next) {
    try { return response.success(res, await service.update(req.params.id, req.body), 'Règle mise à jour'); } catch (e) { next(e); }
  }

  async destroy(req, res, next) {
    try { await service.delete(req.params.id); return response.success(res, null, 'Règle supprimée'); } catch (e) { next(e); }
  }

  async bulkSave(req, res, next) {
    try {
      const { node_id, rows } = req.body;
      const result = await service.bulkSave(node_id, rows);
      return response.success(res, { count: result.length }, `${result.length} règle(s) sauvegardée(s)`);
    } catch (e) { next(e); }
  }
}

module.exports = new StockThresholdController();
