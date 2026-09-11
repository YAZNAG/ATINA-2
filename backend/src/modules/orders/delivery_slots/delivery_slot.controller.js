const svc  = require('./delivery_slot.service');
const resp = require('../../../utils/response');

const fail = (res, next, e) => (e?.statusCode ? resp.error(res, e.message, e.statusCode) : next(e));

class DeliverySlotController {
  async index(req, res, next) {
    try { res.json({ success: true, message: 'Success', ...(await svc.getAll(req.query)) }); } catch (e) { fail(res, next, e); }
  }

  async show(req, res, next) {
    try { resp.success(res, await svc.getById(req.params.id)); } catch (e) { fail(res, next, e); }
  }

  async store(req, res, next) {
    try { resp.success(res, await svc.create(req.body || {}, req), 'Créneau créé', 201); } catch (e) { fail(res, next, e); }
  }

  async bulk(req, res, next) {
    try {
      const r = await svc.bulkCreate(req.body || {}, req);
      const msg = `${r.created} créneau(x) créé(s)${r.skipped.length ? `, ${r.skipped.length} doublon(s) ignoré(s)` : ''}`;
      resp.success(res, r, msg, 201);
    } catch (e) { fail(res, next, e); }
  }

  async update(req, res, next) {
    try { resp.success(res, await svc.update(req.params.id, req.body || {}, req), 'Créneau mis à jour'); } catch (e) { fail(res, next, e); }
  }

  async destroy(req, res, next) {
    try { const r = await svc.delete(req.params.id, req); resp.success(res, r, r.message); } catch (e) { fail(res, next, e); }
  }
}

module.exports = new DeliverySlotController();
