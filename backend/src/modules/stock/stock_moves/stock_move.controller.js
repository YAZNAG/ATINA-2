const service = require('./stock_move.service');

class StockMoveController {
  // GET /stock/moves?node_id=&sku_id=&move_type_id=&operation=&date_from=&date_to=&page=&limit=
  async list(req, res, next) {
    try { return res.json({ success: true, data: await service.getWithFilters(req.query) }); }
    catch (e) { next(e); }
  }

  // GET /stock/moves/stats?node_id=
  async stats(req, res, next) {
    try { return res.json({ success: true, data: await service.getStats(req.query.node_id) }); }
    catch (e) { next(e); }
  }

  // GET /stock/moves/:id
  async getById(req, res, next) {
    try {
      const move = await service.getById(req.params.id);
      if (!move) return res.status(404).json({ success: false, message: 'Mouvement introuvable' });
      return res.json({ success: true, data: move });
    } catch (e) { next(e); }
  }
}

module.exports = new StockMoveController();
