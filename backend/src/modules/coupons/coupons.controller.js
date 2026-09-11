const service  = require('./coupons.service');
const response = require('../../utils/response');

/** Erreur métier enrichie (ex. refus de suppression avec compteur de commandes). */
function handle(err, res, next) {
  if (err && err.statusCode && err.details) {
    return res.status(err.statusCode).json({ success: false, message: err.message, details: err.details });
  }
  if (err && err.code === 'P2002') {
    return res.status(409).json({ success: false, message: 'Ce code existe déjà : le code doit être unique' });
  }
  return next(err);
}

class CouponsController {
  async index(req, res, next) {
    try {
      const result = await service.getAll(req.query);
      return res.json({ success: true, message: 'Success', ...result });
    } catch (err) { handle(err, res, next); }
  }

  async show(req, res, next) {
    try { return response.success(res, await service.getById(req.params.id)); }
    catch (err) { handle(err, res, next); }
  }

  async lookups(req, res, next) {
    try { return response.success(res, await service.getLookups()); }
    catch (err) { handle(err, res, next); }
  }

  async customers(req, res, next) {
    try { return response.success(res, await service.searchCustomers(req.query)); }
    catch (err) { handle(err, res, next); }
  }

  async store(req, res, next) {
    try { return response.success(res, await service.create(req.body, req), 'Code promo créé', 201); }
    catch (err) { handle(err, res, next); }
  }

  async update(req, res, next) {
    try { return response.success(res, await service.update(req.params.id, req.body, req), 'Code promo mis à jour'); }
    catch (err) { handle(err, res, next); }
  }

  async setStatus(req, res, next) {
    try {
      const data = await service.setActive(req.params.id, req.body?.is_active, req);
      return response.success(res, data, data.is_active ? 'Code promo activé' : 'Code promo désactivé');
    } catch (err) { handle(err, res, next); }
  }

  async deletionCheck(req, res, next) {
    try {
      return response.success(res, await service.getDeletionCheck(req.params.id, req, { auditRefusal: req.query.attempt === 'true' }));
    } catch (err) { handle(err, res, next); }
  }

  async destroy(req, res, next) {
    try { await service.remove(req.params.id, req); return response.success(res, null, 'Code promo supprimé'); }
    catch (err) { handle(err, res, next); }
  }

  async redemptions(req, res, next) {
    try {
      const result = await service.getRedemptions(req.query);
      return res.json({ success: true, message: 'Success', ...result });
    } catch (err) { handle(err, res, next); }
  }

  async redemptionOrder(req, res, next) {
    try { return response.success(res, await service.getRedemptionOrder(req.params.orderId)); }
    catch (err) { handle(err, res, next); }
  }
}

module.exports = new CouponsController();
