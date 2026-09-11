const { Router } = require('express');
const svc  = require('./delivery.service');
const resp = require('../../utils/response');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

const canView   = perm.permAny(['orders.view', 'drivers.read', 'dashboard.view']);
const canManage = perm.permAny(['orders.update_status', 'dashboard.view']);

const E = (res, next, e) => e.statusCode ? resp.error(res, e.message, e.statusCode) : next(e);
const wrap = (fn, msg) => async (req, res, next) => {
  try { resp.success(res, await fn(req), msg); } catch (e) { E(res, next, e); }
};

// ── Meta ──────────────────────────────────────────────────────────────────────
router.get('/meta',          canView, wrap(() => svc.getMeta()));
router.get('/drivers',       canView, wrap((req) => svc.listDrivers(req.query)));

// ── Ready home orders ─────────────────────────────────────────────────────────
router.get('/ready-orders',  canView, wrap((req) => svc.listReadyHomeOrders(req.query)));

// ── Tours ─────────────────────────────────────────────────────────────────────
router.get('/tours', canView, async (req, res, next) => {
  try { res.json({ success: true, message: 'Success', ...(await svc.listTours(req.query)) }); } catch (e) { E(res, next, e); }
});
router.get('/tours/:id',     canView,   wrap((req) => svc.getTour(req.params.id)));
router.post('/tours',        canManage, async (req, res, next) => {
  try { resp.success(res, await svc.createTour(req.body, req), 'Tournée créée', 201); } catch (e) { E(res, next, e); }
});
router.patch('/tours/:id',   canManage, wrap((req) => svc.updateTour(req.params.id, req.body || {}, req), 'Tournée mise à jour'));

// ── Tour actions ──────────────────────────────────────────────────────────────
router.patch('/tours/:id/assign-driver', canManage, async (req, res, next) => {
  try {
    const { driver_id } = req.body || {};
    if (!driver_id) return resp.error(res, 'driver_id requis', 400);
    resp.success(res, await svc.assignDriver(req.params.id, driver_id, req), 'Livreur assigné');
  } catch (e) { E(res, next, e); }
});
router.post('/tours/:id/orders',          canManage, wrap((req) => svc.addOrdersToTour(req.params.id, req.body?.order_ids ?? [], req), 'Arrêt(s) ajouté(s)'));
router.delete('/tours/:id/stops/:stopId', canManage, wrap((req) => svc.removeStop(req.params.stopId, req), 'Arrêt retiré'));
router.patch('/tours/:id/reorder',        canManage, wrap((req) => svc.reorderStops(req.params.id, req.body?.stop_ids ?? [], req), 'Ordre des arrêts enregistré'));
router.patch('/tours/:id/start',          canManage, wrap((req) => svc.startTour(req.params.id, req), 'Tournée démarrée'));
router.patch('/tours/:id/complete',       canManage, wrap((req) => svc.completeTour(req.params.id, req), 'Tournée clôturée'));
router.patch('/tours/:id/cancel',         canManage, wrap((req) => svc.cancelTour(req.params.id, req.body || {}, req), 'Tournée annulée'));

// ── Stop actions ──────────────────────────────────────────────────────────────
router.patch('/stops/:stopId/arrive',  canManage, wrap((req) => svc.arriveStop(req.params.stopId, req.body || {})));
router.patch('/stops/:stopId/deliver', canManage, wrap((req) => svc.deliverStop(req.params.stopId, req.body || {}, req), 'Arrêt livré — commande livrée'));
router.patch('/stops/:stopId/fail',    canManage, wrap((req) => svc.failStop(req.params.stopId, req.body || {}, req), 'Échec livraison enregistré'));

module.exports = router;
