const { Router } = require('express');
const ctrl = require('./checkout.controller');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

const canView   = perm.permAny(['orders.view',   'dashboard.view']);
const canCreate = perm.permAny(['orders.create',  'dashboard.view']);

router.get('/meta',            canView,   ctrl.meta.bind(ctrl));
router.post('/eligible-nodes', canView,   ctrl.eligibleNodes.bind(ctrl));
router.get('/delivery-slots',  canView,   ctrl.deliverySlots.bind(ctrl));
router.post('/create-order',   canCreate, ctrl.createOrder.bind(ctrl));

module.exports = router;
