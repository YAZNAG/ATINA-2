const service = require('./app_settings.service');
const response = require('../../utils/response');

class AppSettingsController {
  async configs(req, res, next) {
    try {
      const { data, categories, spec_keys } = await service.listConfigs(req.query);
      return res.json({ success: true, message: 'Success', data, categories, spec_keys });
    } catch (err) { next(err); }
  }

  async valueTypes(req, res, next) {
    try { return response.success(res, await service.listValueTypes()); } catch (err) { next(err); }
  }

  async createConfig(req, res, next) {
    try { return response.success(res, await service.createConfig(req.body, req), 'Paramètre créé', 201); } catch (err) { next(err); }
  }

  async updateConfig(req, res, next) {
    try { return response.success(res, await service.updateConfig(req.params.id, req.body, req), 'Paramètre mis à jour'); } catch (err) { next(err); }
  }

  async paymentMethods(req, res, next) {
    try { return response.success(res, await service.listPaymentMethods()); } catch (err) { next(err); }
  }

  async createPaymentMethod(req, res, next) {
    try { return response.success(res, await service.createPaymentMethod(req.body, req), 'Méthode de paiement ajoutée', 201); } catch (err) { next(err); }
  }

  async updatePaymentMethod(req, res, next) {
    try { return response.success(res, await service.updatePaymentMethod(req.params.id, req.body, req), 'Méthode de paiement mise à jour'); } catch (err) { next(err); }
  }

  async togglePaymentMethod(req, res, next) {
    try {
      const row = await service.togglePaymentMethod(req.params.id, req);
      return response.success(res, row, row.is_active ? 'Méthode de paiement activée' : 'Méthode de paiement désactivée');
    } catch (err) { next(err); }
  }

  /* ── Méthodes de paiement par node (WF #42) ── */

  async nodePaymentMethods(req, res, next) {
    try {
      const { node, data } = await service.listNodePaymentMethods(req.params.node_id);
      return res.json({ success: true, message: 'Success', data, node });
    } catch (err) { next(err); }
  }

  async setNodePaymentMethod(req, res, next) {
    try {
      const row = await service.setNodePaymentMethod(
        req.params.node_id, req.params.method_id, req.body?.is_active, req,
      );
      return response.success(res, row, row.is_active
        ? 'Méthode activée sur ce nœud'
        : 'Méthode désactivée sur ce nœud');
    } catch (err) { next(err); }
  }

  async paymentMatrix(req, res, next) {
    try { return response.success(res, await service.paymentMethodMatrix()); } catch (err) { next(err); }
  }

  async lookups(req, res, next) {
    try { return response.success(res, await service.listLookups()); } catch (err) { next(err); }
  }
}

module.exports = new AppSettingsController();
