const svc  = require('./address.service');
const resp = require('../../utils/response');

class AddressController {
  async listByCustomer(req, res, next) {
    try { resp.success(res, await svc.listByCustomer(req.params.customer_id)); }
    catch(e) { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); }
  }
  async store(req, res, next) {
    try { resp.success(res, await svc.create(req.params.customer_id, req.body), 'Adresse créée', 201); }
    catch(e) { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); }
  }
  async update(req, res, next) {
    try { resp.success(res, await svc.update(req.params.id, req.body), 'Adresse mise à jour'); }
    catch(e) { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); }
  }
  async setDefault(req, res, next) {
    try { resp.success(res, await svc.setDefault(req.params.id), 'Adresse par défaut définie'); }
    catch(e) { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); }
  }
  async destroy(req, res, next) {
    try { await svc.softDelete(req.params.id); resp.success(res, null, 'Adresse supprimée'); }
    catch(e) { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); }
  }
}

module.exports = new AddressController();
