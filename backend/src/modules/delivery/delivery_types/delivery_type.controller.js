const service  = require('./delivery_type.service');
const response = require('../../../utils/response');

class DeliveryTypeController {
  async index(req, res, next) {
    try { return res.json({ success: true, ...(await service.getAll(req.query)) }); } catch (e) { next(e); }
  }
  async show(req, res, next) {
    try { return response.success(res, await service.getById(req.params.id)); } catch (e) { next(e); }
  }
  async store(req, res, next) {
    try { return response.success(res, await service.create(req.body), 'Type de livraison créé', 201); } catch (e) { next(e); }
  }
  async update(req, res, next) {
    try { return response.success(res, await service.update(req.params.id, req.body), 'Type de livraison mis à jour'); } catch (e) { next(e); }
  }
  async destroy(req, res, next) {
    try { await service.delete(req.params.id); return response.success(res, null, 'Type de livraison supprimé'); } catch (e) { next(e); }
  }
  async seedData(req, res, next) {
    try { return response.success(res, await service.seed(), 'Données seedées'); } catch (e) { next(e); }
  }
}

module.exports = new DeliveryTypeController();
