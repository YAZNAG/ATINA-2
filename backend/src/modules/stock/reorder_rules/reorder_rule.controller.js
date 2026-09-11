const service  = require('./reorder_rule.service');
const response = require('../../../utils/response');

class ReorderRuleController {
  // GET /reorder-rules?node_id=&sku_id=&low_stock=&critical_stock=&overstock=&is_active=
  async list(req, res, next) {
    try { return res.json({ success: true, data: await service.getWithFilters(req.query) }); }
    catch (e) { next(e); }
  }

  // GET /reorder-rules/by-node/:node_id
  async byNode(req, res, next) {
    try { return res.json({ success: true, data: await service.getByNode(req.params.node_id) }); }
    catch (e) { next(e); }
  }

  // GET /reorder-rules/refs
  async refs(req, res, next) {
    try { return res.json({ success: true, data: await service.getRefs() }); }
    catch (e) { next(e); }
  }

  // GET /reorder-rules/alerts?node_id=&status=alerte|rupture&sku_id=&sku_family_id=&brand_id=
  // Alertes rupture (US-113) — lecture seule
  async alerts(req, res, next) {
    try { return res.json({ success: true, data: await service.getAlerts(req.query) }); }
    catch (e) { next(e); }
  }

  // GET /reorder-rules/thresholds?node_id=&sku_id=  — règles brutes (seuils)
  async thresholds(req, res, next) {
    try { return res.json({ success: true, data: await service.getThresholds(req.query) }); }
    catch (e) { next(e); }
  }

  // GET /reorder-rules/:id
  async getById(req, res, next) {
    try { return res.json({ success: true, data: await service.getById(req.params.id) }); }
    catch (e) { next(e); }
  }

  // POST /reorder-rules
  async create(req, res, next) {
    try { return response.success(res, await service.create(req.body, req), 'Règle créée', 201); }
    catch (e) { next(e); }
  }

  // PUT /reorder-rules/:id
  async update(req, res, next) {
    try { return response.success(res, await service.updateById(req.params.id, req.body, req), 'Règle mise à jour'); }
    catch (e) { next(e); }
  }

  // DELETE /reorder-rules/:id
  async remove(req, res, next) {
    try { await service.remove(req.params.id, req); return response.success(res, null, 'Règle supprimée'); }
    catch (e) { next(e); }
  }

  // POST /reorder-rules/bulk-save
  async bulkSave(req, res, next) {
    try {
      const results = await service.bulkSave(Array.isArray(req.body) ? req.body : req.body?.rows, req);
      return response.success(res, results, `${results.length} règle(s) enregistrée(s)`);
    } catch (e) { next(e); }
  }

  // POST /reorder-rules/should-reorder
  async shouldReorder(req, res, next) {
    try { return res.json({ success: true, data: await service.shouldReorder(req.body) }); }
    catch (e) { next(e); }
  }

  // POST /reorder-rules/detect-critical
  async detectCritical(req, res, next) {
    try { return res.json({ success: true, data: await service.detectCritical(req.body) }); }
    catch (e) { next(e); }
  }

  // POST /reorder-rules/detect-overstock
  async detectOverstock(req, res, next) {
    try { return res.json({ success: true, data: await service.detectOverstock(req.body) }); }
    catch (e) { next(e); }
  }

  // GET /reorder-rules/suggested-qty?node_id=&sku_id=
  async suggestedQty(req, res, next) {
    try { return res.json({ success: true, data: await service.suggestedQty(req.query) }); }
    catch (e) { next(e); }
  }
}

module.exports = new ReorderRuleController();
