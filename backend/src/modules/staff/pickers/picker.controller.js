const svc  = require('./picker.service');
const resp = require('../../../utils/response');
const { audit } = require('../../../utils/audit');
const E = (res, next, err) => { if (err.statusCode) return resp.error(res, err.message, err.statusCode); next(err); };

const R = 'pickers';

class PickerController {
  async index(req, res, next)       { try { res.json({ success: true, message: 'Success', ...(await svc.list(req.query)) }); } catch(e){E(res,next,e);} }
  async show(req, res, next)        { try { resp.success(res, await svc.getById(req.params.id)); } catch(e){E(res,next,e);} }

  async store(req, res, next) {
    try {
      const p = await svc.create(req.body, req.user?.id);
      await audit(req, { action: 'CREATE', resource: R, resource_id: p.id, new_values: { name: p.name, node_id: p.node_id, phone: `${p.phone_country} ${p.phone_number}`, email: p.email } });
      resp.success(res, p, 'Picker créé', 201);
    } catch(e){E(res,next,e);}
  }

  async update(req, res, next) {
    try {
      const { before, after } = await svc.update(req.params.id, req.body);
      const pickFields = (o) => o && ({ name: o.name, node_id: o.node_id, phone_country: o.phone_country, phone_number: o.phone_number, email: o.email, is_active: o.is_active });
      await audit(req, { action: 'UPDATE', resource: R, resource_id: req.params.id, old_values: pickFields(before), new_values: pickFields(after) });
      resp.success(res, after, 'Picker mis à jour');
    } catch(e){E(res,next,e);}
  }

  async activate(req, res, next) {
    try {
      const p = await svc.activate(req.params.id);
      await audit(req, { action: 'ACTIVATE', resource: R, resource_id: req.params.id, new_values: { is_active: true } });
      resp.success(res, p, 'Picker activé');
    } catch(e){E(res,next,e);}
  }

  async deactivate(req, res, next) {
    try {
      const p = await svc.deactivate(req.params.id);
      await audit(req, { action: 'DEACTIVATE', resource: R, resource_id: req.params.id, new_values: { is_active: false } });
      const msg = p.active_sessions > 0
        ? `Picker désactivé — ${p.active_sessions} session(s) en cours à réassigner`
        : 'Picker désactivé';
      resp.success(res, p, msg);
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
      const p = await svc.delete(req.params.id);
      await audit(req, { action: 'DELETE', resource: R, resource_id: req.params.id, new_values: { is_deleted: true } });
      resp.success(res, p, 'Picker supprimé');
    } catch(e){E(res,next,e);}
  }

  async stats(req, res, next)    { try { resp.success(res, await svc.getStats(req.params.id, req.query)); } catch(e){E(res,next,e);} }
  async sessions(req, res, next) { try { res.json({ success:true, message: 'Success', ...(await svc.getSessions(req.params.id, req.query)) }); } catch(e){E(res,next,e);} }
  async orders(req, res, next)   { try { res.json({ success:true, message: 'Success', ...(await svc.getOrders(req.params.id, req.query)) }); } catch(e){E(res,next,e);} }
}
module.exports = new PickerController();
