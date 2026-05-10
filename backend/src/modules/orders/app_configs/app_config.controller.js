const svc  = require('./app_config.service');
const resp = require('../../../utils/response');

class AppConfigController {
  async index(req, res, next)   { try { resp.success(res, await svc.getAll(req.query)); } catch(e) { next(e); } }
  async save(req, res, next)    { try { resp.success(res, await svc.save(req.body, req.user?.id || 1), 'Configuration enregistrée'); } catch(e) { next(e); } }
  async destroy(req, res, next) { try { await svc.delete(req.params.id); resp.success(res, null, 'Configuration supprimée'); } catch(e) { next(e); } }
  async seedDefaults(req, res, next) { try { resp.success(res, await svc.seedDefaults(req.user?.id || 1), 'Configurations seedées'); } catch(e) { next(e); } }
  async keys(req, res, next)    { try { resp.success(res, { order_rules: svc.getOrderRuleKeys(), payment: svc.getPaymentKeys() }); } catch(e) { next(e); } }
}

module.exports = new AppConfigController();
