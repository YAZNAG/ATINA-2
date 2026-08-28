const service  = require('./stock_level.service');
const response = require('../../../utils/response');

class StockLevelController {
  // GET /levels?node_id=&sku_id=&category_id=&out_of_stock=&low_stock=&backordered=&has_incoming=&has_cod=
  async list(req, res, next) {
    try { return res.json({ success: true, data: await service.getWithFilters(req.query) }); }
    catch (e) { next(e); }
  }

  // GET /levels/by-node/:node_id
  async byNode(req, res, next) {
    try { return res.json({ success: true, data: await service.getByNode(req.params.node_id) }); }
    catch (e) { next(e); }
  }

  // GET /levels/:id
  async getById(req, res, next) {
    try { return res.json({ success: true, data: await service.getById(req.params.id) }); }
    catch (e) { next(e); }
  }

  async receipt(req, res, next) {
    try { return response.success(res, await service.receipt(req.body), 'Réception enregistrée', 201); }
    catch (e) { next(e); }
  }

  async reserve(req, res, next) {
    try { return response.success(res, await service.reserve(req.body), 'Stock réservé', 201); }
    catch (e) { next(e); }
  }

  async picking(req, res, next) {
    try { return response.success(res, await service.picking(req.body), 'Picking confirmé', 201); }
    catch (e) { next(e); }
  }

  async cancel(req, res, next) {
    try { return response.success(res, await service.cancel(req.body), 'Réservation annulée'); }
    catch (e) { next(e); }
  }

  async incoming(req, res, next) {
    try { return response.success(res, await service.incoming(req.body), 'Stock attendu mis à jour'); }
    catch (e) { next(e); }
  }

  async codDelivered(req, res, next) {
    try { return response.success(res, await service.codDelivered(req.body), 'COD livré enregistré'); }
    catch (e) { next(e); }
  }

  async codCollected(req, res, next) {
    try { return response.success(res, await service.codCollected(req.body), 'COD collecté enregistré'); }
    catch (e) { next(e); }
  }

  async count(req, res, next) {
    try { return response.success(res, await service.count(req.body), 'Inventaire marqué'); }
    catch (e) { next(e); }
  }

  async adjust(req, res, next) {
    try { return response.success(res, await service.adjust(req.body), 'Stock ajusté'); }
    catch (e) { next(e); }
  }

  async recalculate(req, res, next) {
    try { return response.success(res, await service.recalculate(req.body), 'Recalcul terminé'); }
    catch (e) { next(e); }
  }

  async applyMove(req, res, next) {
    try { return response.success(res, await service.applyMove(req.body), 'Mouvement appliqué', 201); }
    catch (e) { next(e); }
  }

  async bySku(req, res, next) {
  try { return res.json({ success: true, data: await service.getAllBySku(req.params.sku_id) }); }
  catch (e) { next(e); }
}

async listMoves(req, res, next) {
  try { return res.json({ success: true, data: await service.getMoves(req.query) }); }
  catch (e) { next(e); }
}
}

module.exports = new StockLevelController();
