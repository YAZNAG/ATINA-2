const { Router }   = require('express');
const ctrl         = require('./customer_checkout.controller');
const customerAuth = require('../../middlewares/customer_auth.middleware');

const router = Router();
router.use(customerAuth);

router.get('/meta',            ctrl.meta.bind(ctrl));
router.get('/delivery-slots',  ctrl.deliverySlots.bind(ctrl));
router.post('/eligible-nodes', ctrl.eligibleNodes.bind(ctrl));
router.get('/pickup-nodes',    ctrl.pickupNodes.bind(ctrl));
router.post('/create-order',   ctrl.createOrder.bind(ctrl));

module.exports = router;
