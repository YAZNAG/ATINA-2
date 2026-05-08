const service  = require('./stock_level.service');
const response = require('../../../utils/response');

class StockLevelController {
  async byNode(req, res, next) {
    try { return res.json({ success: true, data: await service.getByNode(req.query.node_id) }); }
    catch (e) { next(e); }
  }

  async applyMove(req, res, next) {
    try { return response.success(res, await service.applyMove(req.body), 'Mouvement appliqué', 201); }
    catch (e) { next(e); }
  }

  async adjust(req, res, next) {
    try { return response.success(res, await service.adjust(req.body), 'Stock ajusté'); }
    catch (e) { next(e); }
  }
}

module.exports = new StockLevelController();
