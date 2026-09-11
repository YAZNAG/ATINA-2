const service = require('./stock_counts.service');
const response = require('../../utils/response');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const checkId = (id) => {
  if (!UUID_RE.test(String(id || ''))) throw { statusCode: 404, message: 'Session de comptage introuvable' };
};

class StockCountController {
  // GET /stock-counts/refs
  async refs(req, res, next) {
    try { return response.success(res, await service.getRefs()); }
    catch (err) { next(err); }
  }

  // GET /stock-counts?node_id=&status=&date_from=&date_to=&search=&page=&limit=
  async index(req, res, next) {
    try {
      const { data, pagination } = await service.list(req.query);
      return res.json({ success: true, message: 'Success', data, pagination });
    } catch (err) { next(err); }
  }

  // GET /stock-counts/:id
  async show(req, res, next) {
    try { checkId(req.params.id); return response.success(res, await service.getById(req.params.id)); }
    catch (err) { next(err); }
  }

  // POST /stock-counts  { node_id, zone_id?, category_id?, notes? }
  async store(req, res, next) {
    try { return response.success(res, await service.create(req, req.body), 'Session de comptage créée', 201); }
    catch (err) { next(err); }
  }

  // PUT /stock-counts/:id/lines  { lines: [{ id, qty_counted, note }] }
  async saveLines(req, res, next) {
    try {
      checkId(req.params.id);
      const result = await service.saveLines(req, req.params.id, req.body);
      return response.success(res, result, `${result.saved} ligne(s) enregistrée(s)`);
    } catch (err) { next(err); }
  }

  // POST /stock-counts/:id/validate
  async validate(req, res, next) {
    try {
      checkId(req.params.id);
      const result = await service.validate(req, req.params.id);
      return response.success(res, result, `Comptage validé : ${result.adjustments_count} ajustement(s) généré(s)`);
    } catch (err) { next(err); }
  }

  // POST /stock-counts/:id/cancel  { reason? }
  async cancel(req, res, next) {
    try { checkId(req.params.id); return response.success(res, await service.cancel(req, req.params.id, req.body), 'Session de comptage annulée'); }
    catch (err) { next(err); }
  }
}

module.exports = new StockCountController();
