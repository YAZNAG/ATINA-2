const { Router } = require('express');
const svc  = require('./delivery.service');
const resp = require('../../utils/response');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

const canView   = perm.permAny(['orders.view',         'dashboard.view']);
const canManage = perm.permAny(['orders.update_status', 'dashboard.view']);

const E = (res, next, e) => e.statusCode ? resp.error(res, e.message, e.statusCode) : next(e);

// ── Meta ──────────────────────────────────────────────────────────────────────
router.get('/meta',            canView,   async (req, res, next) => { try { resp.success(res, await svc.getMeta()); } catch(e) { E(res, next, e); } });
router.get('/drivers',         canView,   async (req, res, next) => { try { resp.success(res, await svc.listDrivers(req.query)); } catch(e) { E(res, next, e); } });

// ── Ready home orders ─────────────────────────────────────────────────────────
router.get('/ready-orders',    canView,   async (req, res, next) => { try { resp.success(res, await svc.listReadyHomeOrders(req.query)); } catch(e) { E(res, next, e); } });

// ── Tours CRUD ────────────────────────────────────────────────────────────────
router.get('/tours',           canView,   async (req, res, next) => { try { res.json({ success: true, ...(await svc.listTours(req.query)) }); } catch(e) { E(res, next, e); } });
router.get('/tours/:id',       canView,   async (req, res, next) => { try { resp.success(res, await svc.getTour(req.params.id)); } catch(e) { E(res, next, e); } });
router.post('/tours',          canManage, async (req, res, next) => { try { resp.success(res, await svc.createTour(req.body), 'Tournée créée', 201); } catch(e) { E(res, next, e); } });

// ── Tour actions ──────────────────────────────────────────────────────────────
router.patch('/tours/:id/assign-driver', canManage, async (req, res, next) => {
  try {
    const { driver_id } = req.body;
    if (!driver_id) return resp.error(res, 'driver_id requis', 400);
    resp.success(res, await svc.assignDriver(req.params.id, driver_id));
  } catch(e) { E(res, next, e); }
});

router.post('/tours/:id/orders',          canManage, async (req, res, next) => {
  try { resp.success(res, await svc.addOrdersToTour(req.params.id, req.body.order_ids ?? [])); } catch(e) { E(res, next, e); }
});

router.delete('/tours/:id/stops/:stopId', canManage, async (req, res, next) => {
  try { resp.success(res, await svc.removeStop(req.params.stopId)); } catch(e) { E(res, next, e); }
});

router.patch('/tours/:id/start',          canManage, async (req, res, next) => {
  try { resp.success(res, await svc.startTour(req.params.id), 'Tournée démarrée'); } catch(e) { E(res, next, e); }
});

router.patch('/tours/:id/complete',       canManage, async (req, res, next) => {
  try { resp.success(res, await svc.completeTour(req.params.id), 'Tournée clôturée'); } catch(e) { E(res, next, e); }
});

// ── Stop actions ──────────────────────────────────────────────────────────────
router.patch('/stops/:stopId/arrive',  canManage, async (req, res, next) => {
  try { resp.success(res, await svc.arriveStop(req.params.stopId, req.body)); } catch(e) { E(res, next, e); }
});

router.patch('/stops/:stopId/deliver', canManage, async (req, res, next) => {
  try { resp.success(res, await svc.deliverStop(req.params.stopId, req.body), 'Stop livré — commande delivered'); } catch(e) { E(res, next, e); }
});

router.patch('/stops/:stopId/fail',    canManage, async (req, res, next) => {
  try { resp.success(res, await svc.failStop(req.params.stopId, req.body), 'Échec livraison enregistré'); } catch(e) { E(res, next, e); }
});

module.exports = router;
