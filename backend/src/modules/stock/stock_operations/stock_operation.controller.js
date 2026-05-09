const service = require('./stock_operation.service');

class StockOperationController {
  async list(req, res, next) {
    try { return res.json({ success: true, data: await service.getAll() }); }
    catch (e) { next(e); }
  }

  async seed(req, res, next) {
    try { return res.json({ success: true, data: await service.seed(), message: 'Opérations seedées' }); }
    catch (e) { next(e); }
  }
}

module.exports = new StockOperationController();
