const svc  = require('./customer_me.service');
const resp = require('../../utils/response');
const E = (res, next, e) => { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); };

class CustomerMeController {
  // Profile
  async getProfile(req, res, next) {
    try { resp.success(res, await svc.getProfile(req.customerId)); }
    catch(e) { E(res, next, e); }
  }
  async updateProfile(req, res, next) {
    try { resp.success(res, await svc.updateProfile(req.customerId, req.body), 'Profil mis à jour'); }
    catch(e) { E(res, next, e); }
  }

  // Addresses
  async listAddresses(req, res, next) {
    try { resp.success(res, await svc.listAddresses(req.customerId)); }
    catch(e) { E(res, next, e); }
  }
  async createAddress(req, res, next) {
    try { resp.success(res, await svc.createAddress(req.customerId, req.body), 'Adresse créée', 201); }
    catch(e) { E(res, next, e); }
  }
  async updateAddress(req, res, next) {
    try { resp.success(res, await svc.updateAddress(req.customerId, req.params.id, req.body), 'Adresse mise à jour'); }
    catch(e) { E(res, next, e); }
  }
  async setDefaultAddress(req, res, next) {
    try { resp.success(res, await svc.setDefaultAddress(req.customerId, req.params.id), 'Adresse par défaut définie'); }
    catch(e) { E(res, next, e); }
  }
  async deleteAddress(req, res, next) {
    try { await svc.deleteAddress(req.customerId, req.params.id); resp.success(res, null, 'Adresse supprimée'); }
    catch(e) { E(res, next, e); }
  }

  // Orders
  async listOrders(req, res, next) {
    try { resp.success(res, await svc.listOrders(req.customerId)); }
    catch(e) { E(res, next, e); }
  }
  async getOrderById(req, res, next) {
    try { resp.success(res, await svc.getOrderById(req.customerId, req.params.id)); }
    catch(e) { E(res, next, e); }
  }
}

module.exports = new CustomerMeController();
