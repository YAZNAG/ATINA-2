const svc  = require('./picker.service');
const resp = require('../../../utils/response');
const E = (res, next, err) => { if (err.statusCode) return resp.error(res, err.message, err.statusCode); next(err); };

class PickerController {
  async index(req, res, next)       { try { res.json({ success: true, ...(await svc.list(req.query)) }); }   catch(e){E(res,next,e);} }
  async show(req, res, next)        { try { resp.success(res, await svc.getById(req.params.id)); }             catch(e){E(res,next,e);} }
  async store(req, res, next)       { try { resp.success(res, await svc.create(req.body, req.user?.id), 'Picker créé', 201); } catch(e){E(res,next,e);} }
  async update(req, res, next)      { try { resp.success(res, await svc.update(req.params.id, req.body), 'Picker mis à jour'); } catch(e){E(res,next,e);} }
  async activate(req, res, next)    { try { resp.success(res, await svc.activate(req.params.id), 'Picker activé'); }           catch(e){E(res,next,e);} }
  async deactivate(req, res, next)  { try { resp.success(res, await svc.deactivate(req.params.id), 'Picker désactivé'); }      catch(e){E(res,next,e);} }
  async resetPassword(req, res, next) {
    try {
      const { password } = req.body;
      if (!password) return resp.error(res, 'password requis', 400);
      resp.success(res, await svc.resetPassword(req.params.id, password), 'Mot de passe réinitialisé');
    } catch(e){E(res,next,e);}
  }
  async destroy(req, res, next)     { try { resp.success(res, await svc.delete(req.params.id), 'Picker supprimé'); }           catch(e){E(res,next,e);} }
}
module.exports = new PickerController();
