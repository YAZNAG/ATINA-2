const service = require('./stock_move.service');

class StockMoveController {
  // GET /?node_id=&sku_id=&move_type_id=&operation=&date_from=&date_to=&page=&limit=
  async list(req, res, next) {
    try {
      const { data, total, page, limit, pages } = await service.getWithFilters(req.query);
      return res.json({ success: true, data, total, page, limit, pages });
    } catch (e) { next(e); }
  }

  // GET /stats?node_id=
  async stats(req, res, next) {
    try { return res.json({ success: true, data: await service.getStats(req.query.node_id) }); }
    catch (e) { next(e); }
  }

  // GET /:id
  async getById(req, res, next) {
    try { return res.json({ success: true, data: await service.getById(req.params.id) }); }
    catch (e) { next(e); }
  }
}

module.exports = new StockMoveController();