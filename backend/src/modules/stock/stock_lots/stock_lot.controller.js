const service  = require('./stock_lot.service');
const response = require('../../../utils/response');

class StockLotController {
  // GET /stock/lots?node_id=&sku_id=&expiring_soon=&expired=&exhausted=&active=
  async list(req, res, next) {
    try { return res.json({ success: true, data: await service.getWithFilters(req.query) }); }
    catch (e) { next(e); }
  }

  // GET /stock/lots/alerts?node_id=
  async alerts(req, res, next) {
    try { return res.json({ success: true, data: await service.getAlerts(req.query.node_id) }); }
    catch (e) { next(e); }
  }

  // GET /stock/lots/:id
  async getById(req, res, next) {
    try {
      const lot = await service.getById(req.params.id);
      if (!lot) return res.status(404).json({ success: false, message: 'Lot introuvable' });
      return res.json({ success: true, data: lot });
    } catch (e) { next(e); }
  }

  // POST /stock/lots
  async create(req, res, next) {
    try { return response.success(res, await service.create(req.body), 'Lot créé', 201); }
    catch (e) { next(e); }
  }

  // DELETE /stock/lots/:id
  async remove(req, res, next) {
    try { await service.remove(req.params.id); return response.success(res, null, 'Lot supprimé'); }
    catch (e) { next(e); }
  }
}

module.exports = new StockLotController();
