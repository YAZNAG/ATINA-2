const svc  = require('./payment_method.service');
const resp = require('../../../utils/response');

class PaymentMethodController {
  async index(req, res, next)        { try { res.json({ success: true, ...(await svc.getAll(req.query)) }); } catch(e) { next(e); } }
  async show(req, res, next)         { try { resp.success(res, await svc.getById(req.params.id)); } catch(e) { next(e); } }
  async store(req, res, next)        { try { resp.success(res, await svc.create(req.body), 'Méthode créée', 201); } catch(e) { next(e); } }
  async update(req, res, next)       { try { resp.success(res, await svc.update(req.params.id, req.body), 'Méthode mise à jour'); } catch(e) { next(e); } }
  async destroy(req, res, next)      { try { await svc.delete(req.params.id); resp.success(res, null, 'Méthode supprimée'); } catch(e) { next(e); } }
  async toggleActive(req, res, next) { try { resp.success(res, await svc.toggleActive(req.params.id), 'Statut basculé'); } catch(e) { next(e); } }
  async seedData(req, res, next)     { try { resp.success(res, await svc.seed(), 'Données seedées'); } catch(e) { next(e); } }
}

module.exports = new PaymentMethodController();
