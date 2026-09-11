const svc  = require('./driver.service');
const resp = require('../../../utils/response');
const { audit } = require('../../../utils/audit');
const E = (res, next, err) => { if (err.statusCode) return resp.error(res, err.message, err.statusCode); next(err); };

const R = 'drivers';
const pickFields = (o) => o && ({ name: o.name, node_id: o.node_id, phone_country: o.phone_country, phone_number: o.phone_number, vehicle_type: o.vehicle_type, vehicle_plate: o.vehicle_plate, is_active: o.is_active });

class DriverController {
  async index(req, res, next)        { try { res.json({ success: true, message: 'Success', ...(await svc.list(req.query)) }); } catch(e){E(res,next,e);} }
  async show(req, res, next)         { try { resp.success(res, await svc.getById(req.params.id)); } catch(e){E(res,next,e);} }

  async store(req, res, next) {
    try {
      const d = await svc.create(req.body, req.user?.id);
      await audit(req, { action: 'CREATE', resource: R, resource_id: d.id, new_values: pickFields(d) });
      resp.success(res, d, 'Livreur créé', 201);
    } catch(e){E(res,next,e);}
  }

  async update(req, res, next) {
    try {
      const { before, after } = await svc.update(req.params.id, req.body);
      await audit(req, { action: 'UPDATE', resource: R, resource_id: req.params.id, old_values: pickFields(before), new_values: pickFields(after) });
      resp.success(res, after, 'Livreur mis à jour');
    } catch(e){E(res,next,e);}
  }

  async activate(req, res, next) {
    try {
      const d = await svc.activate(req.params.id);
      await audit(req, { action: 'ACTIVATE', resource: R, resource_id: req.params.id, new_values: { is_active: true } });
      resp.success(res, d, 'Livreur activé');
    } catch(e){E(res,next,e);}
  }

  async deactivate(req, res, next) {
    try {
      const d = await svc.deactivate(req.params.id);
      await audit(req, { action: 'DEACTIVATE', resource: R, resource_id: req.params.id, new_values: { is_active: false } });
      const msg = d.open_tours > 0
        ? `Livreur désactivé — ${d.open_tours} tournée(s) planifiée(s) ou en cours à réassigner`
        : 'Livreur désactivé';
      resp.success(res, d, msg);
    } catch(e){E(res,next,e);}
  }

  async resetPassword(req, res, next) {
    try {
      const { password } = req.body;
      if (!password) return resp.error(res, 'Mot de passe requis', 400);
      const r = await svc.resetPassword(req.params.id, password);
      await audit(req, { action: 'RESET_PASSWORD', resource: R, resource_id: req.params.id });
      resp.success(res, r, 'Mot de passe réinitialisé');
    } catch(e){E(res,next,e);}
  }

  async destroy(req, res, next) {
    try {
      const d = await svc.delete(req.params.id);
      await audit(req, { action: 'DELETE', resource: R, resource_id: req.params.id, new_values: { is_deleted: true } });
      resp.success(res, d, 'Livreur supprimé');
    } catch(e){E(res,next,e);}
  }

  async stats(req, res, next) { try { resp.success(res, await svc.getStats(req.params.id, req.query)); } catch(e){E(res,next,e);} }
  async tours(req, res, next) { try { res.json({ success: true, message: 'Success', ...(await svc.getTours(req.params.id, req.query)) }); } catch(e){E(res,next,e);} }
}
module.exports = new DriverController();
