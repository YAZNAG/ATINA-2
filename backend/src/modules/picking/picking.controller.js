const svc  = require('./picking.service');
const resp = require('../../utils/response');
const { audit } = require('../../utils/audit');

const E = (res, next, err) => { if (err.statusCode) return resp.error(res, err.message, err.statusCode); next(err); };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class PickingController {
  async listSessions(req, res, next)  { try { res.json({ success: true, message: 'Success', ...(await svc.listSessions(req.query)) }); } catch(e) { E(res,next,e); } }
  async exportSessions(req, res, next) { try { resp.success(res, await svc.exportSessions(req.query)); } catch(e) { E(res,next,e); } }
  async getSession(req, res, next)    {
    try {
      if (!UUID_RE.test(req.params.id)) return resp.error(res, 'Identifiant de session invalide', 400);
      resp.success(res, await svc.getSession(req.params.id));
    } catch(e) { E(res,next,e); }
  }
  async createSession(req, res, next) {
    try {
      const { order_id } = req.body;
      if (!order_id) return resp.error(res, 'order_id requis', 400);
      const s = await svc.createSession(order_id);
      await audit(req, { action: 'CREATE', resource: 'picking_sessions', resource_id: s?.id, new_values: { order_id } });
      resp.success(res, s, 'Session créée', 201);
    } catch(e) { E(res,next,e); }
  }
  async startSession(req, res, next) {
    try {
      const s = await svc.startSession(req.params.id, { ...req.body, changed_by: req.user?.id ?? null });
      await audit(req, { action: 'START', resource: 'picking_sessions', resource_id: req.params.id, new_values: { status: 'in_progress' } });
      resp.success(res, s, 'Session démarrée');
    } catch(e) { E(res,next,e); }
  }
  async completeSession(req, res, next) {
    try {
      const s = await svc.completeSession(req.params.id, req.user?.id ?? null);
      await audit(req, { action: 'COMPLETE', resource: 'picking_sessions', resource_id: req.params.id, new_values: { status: 'completed' } });
      resp.success(res, s, 'Session terminée — commande Prête');
    } catch(e) { E(res,next,e); }
  }
  async cancelSession(req, res, next) {
    try {
      const s = await svc.cancelSession(req.params.id);
      await audit(req, { action: 'CANCEL', resource: 'picking_sessions', resource_id: req.params.id, new_values: { status: 'cancelled', reason: req.body?.reason ?? null } });
      resp.success(res, s, 'Session annulée');
    } catch(e) { E(res,next,e); }
  }
  async pickItem(req, res, next) {
    try {
      const it = await svc.pickItem(req.params.id, req.body);
      await audit(req, { action: 'PICK_ITEM', resource: 'picking_session_items', resource_id: req.params.id, new_values: { qty_picked: req.body?.qty_picked ?? null, scanned_ean: req.body?.scanned_ean ?? null } });
      resp.success(res, it, 'Article préparé');
    } catch(e) { E(res,next,e); }
  }
  async substituteItem(req, res, next) {
    try {
      const it = await svc.substituteItem(req.params.id, req.body || {});
      await audit(req, { action: 'SUBSTITUTE_ITEM', resource: 'picking_session_items', resource_id: req.params.id, new_values: { reason: req.body?.reason ?? null } });
      resp.success(res, it, 'Article substitué');
    } catch(e) { E(res,next,e); }
  }
  async outOfStock(req, res, next) {
    try {
      const it = await svc.outOfStock(req.params.id);
      await audit(req, { action: 'OUT_OF_STOCK_ITEM', resource: 'picking_session_items', resource_id: req.params.id });
      resp.success(res, it, 'Rupture enregistrée');
    } catch(e) { E(res,next,e); }
  }
  async listPickers(req, res, next)     { try { resp.success(res, await svc.listPickers(req.query.node_id)); } catch(e) { E(res,next,e); } }

  // US-067 : réassignation auditée (old/new picker).
  async assignPicker(req, res, next) {
    try {
      const { picker_id, reason } = req.body || {};
      if (!picker_id) return resp.error(res, 'picker_id requis', 400);
      const r = await svc.assignPicker(req.params.id, picker_id);
      await audit(req, {
        action: 'REASSIGN_PICKER',
        resource: 'picking_sessions',
        resource_id: req.params.id,
        old_values: { picker_id: r.old_picker?.id ?? null, picker_name: r.old_picker?.name ?? null },
        new_values: { picker_id: r.new_picker.id, picker_name: r.new_picker.name, reason: reason ?? null },
      });
      resp.success(res, r.session, r.old_picker ? 'Picker réassigné' : 'Picker affecté');
    } catch(e) { E(res,next,e); }
  }
}

module.exports = new PickingController();
