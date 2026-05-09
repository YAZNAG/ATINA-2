const service  = require('./selling_rule.service');
const response = require('../../../utils/response');

class SellingRuleController {
  // GET /selling-rules?node_id=&sku_id=&backorderable=&limit_reached=&out_of_stock=
  async list(req, res, next) {
    try { return res.json({ success: true, data: await service.getWithFilters(req.query) }); }
    catch (e) { next(e); }
  }

  // GET /selling-rules/by-node/:node_id
  async byNode(req, res, next) {
    try { return res.json({ success: true, data: await service.getByNode(req.params.node_id) }); }
    catch (e) { next(e); }
  }

  // GET /selling-rules/estimated-delivery?node_id=&sku_id=
  async estimatedDelivery(req, res, next) {
    try { return res.json({ success: true, data: await service.estimatedDelivery(req.query) }); }
    catch (e) { next(e); }
  }

  // GET /selling-rules/:id
  async getById(req, res, next) {
    try { return res.json({ success: true, data: await service.getById(req.params.id) }); }
    catch (e) { next(e); }
  }

  // POST /selling-rules  (upsert)
  async upsert(req, res, next) {
    try { return response.success(res, await service.upsert(req.body), 'Règle de vente enregistrée', 201); }
    catch (e) { next(e); }
  }

  // PUT /selling-rules/:id
  async update(req, res, next) {
    try { return response.success(res, await service.updateById(req.params.id, req.body), 'Règle de vente mise à jour'); }
    catch (e) { next(e); }
  }

  // DELETE /selling-rules/:id
  async remove(req, res, next) {
    try { await service.remove(req.params.id); return response.success(res, null, 'Règle de vente supprimée'); }
    catch (e) { next(e); }
  }

  // POST /selling-rules/bulk-save
  async bulkSave(req, res, next) {
    try {
      const results = await service.bulkSave(req.body);
      return response.success(res, results, `${results.length} règle(s) enregistrée(s)`, 200);
    } catch (e) { next(e); }
  }

  // POST /selling-rules/can-sell
  async canSell(req, res, next) {
    try { return res.json({ success: true, data: await service.canSell(req.body) }); }
    catch (e) { next(e); }
  }

  // POST /selling-rules/reserve-backorder
  async reserveBackorder(req, res, next) {
    try { return response.success(res, await service.reserveBackorder(req.body), 'Backorder réservé'); }
    catch (e) { next(e); }
  }

  // POST /selling-rules/release-backorder
  async releaseBackorder(req, res, next) {
    try { return response.success(res, await service.releaseBackorder(req.body), 'Backorder libéré'); }
    catch (e) { next(e); }
  }
}

module.exports = new SellingRuleController();
