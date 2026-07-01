const service  = require('./coupons.service');
const response = require('../../utils/response');

class CouponsController {
  async index(req, res, next) {
    try {
      const result = await service.getAll(req.query);
      return res.json({ success: true, message: 'Success', ...result });
    } catch (err) { next(err); }
  }

  async show(req, res, next) {
    try { return response.success(res, await service.getById(req.params.id)); }
    catch (err) { next(err); }
  }

  async store(req, res, next) {
    try { return response.success(res, await service.create(req.body), 'Coupon créé', 201); }
    catch (err) { next(err); }
  }

  async update(req, res, next) {
    try { return response.success(res, await service.update(req.params.id, req.body), 'Coupon mis à jour'); }
    catch (err) { next(err); }
  }

  async destroy(req, res, next) {
    try { await service.remove(req.params.id); return response.success(res, null, 'Coupon supprimé'); }
    catch (err) { next(err); }
  }
}

module.exports = new CouponsController();