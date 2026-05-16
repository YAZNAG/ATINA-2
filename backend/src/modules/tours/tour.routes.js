const { Router } = require('express');
const ctrl = require('./tour.controller');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

const canView   = perm.permAny(['orders.view', 'dashboard.view']);
const canManage = perm.permAny(['orders.update_status', 'dashboard.view']);

router.get('/meta',                        canView,   ctrl.meta.bind(ctrl));
router.get('/ready-orders',                canView,   ctrl.readyOrders.bind(ctrl));
router.get('/',                            canView,   ctrl.index.bind(ctrl));
router.get('/:id',                         canView,   ctrl.show.bind(ctrl));
router.post('/',                           canManage, ctrl.create.bind(ctrl));
router.post('/:id/orders',                 canManage, ctrl.addOrders.bind(ctrl));
router.delete('/:id/stops/:stopId',        canManage, ctrl.removeStop.bind(ctrl));
router.patch('/:id/start',                 canManage, ctrl.start.bind(ctrl));
router.patch('/:id/stops/:stopId/deliver', canManage, ctrl.deliverStop.bind(ctrl));
router.patch('/:id/stops/:stopId/fail',    canManage, ctrl.failStop.bind(ctrl));
router.patch('/:id/complete',              canManage, ctrl.complete.bind(ctrl));

module.exports = router;
