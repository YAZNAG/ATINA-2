const service = require('./tax.service');
const response = require('../../../utils/response');

class TaxController {
  async index(req, res, next) {
    try {
      if (req.query.all === 'true') {
        const data = await service.getList();
        return response.success(res, data);
      }
      const result = await service.getAll(req.query);
      return res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }
  async show(req, res, next) {
    try { return response.success(res, await service.getById(req.params.id)); }
    catch (err) { next(err); }
  }
  async store(req, res, next) {
    try { return response.success(res, await service.create(req.body), 'TVA créée', 201); }
    catch (err) { next(err); }
  }
  async update(req, res, next) {
    try { return response.success(res, await service.update(req.params.id, req.body), 'TVA mise à jour'); }
    catch (err) { next(err); }
  }
  async destroy(req, res, next) {
    try { await service.delete(req.params.id); return response.success(res, null, 'TVA supprimée'); }
    catch (err) { next(err); }
  }
}

module.exports = new TaxController();
