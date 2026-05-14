const { Router } = require('express');
const ctrl = require('./checkout.controller');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

const canAccess = perm.permAny(['dashboard.view', 'orders.view', 'orders.create']);

router.get('/meta',                                canAccess, ctrl.meta.bind(ctrl));
router.get('/available-dates',                     canAccess, ctrl.availableDates.bind(ctrl));
router.get('/articles',                            canAccess, ctrl.articles.bind(ctrl));
router.get('/customers',                           canAccess, ctrl.customers.bind(ctrl));
router.get('/customers/:customerId/addresses',     canAccess, ctrl.customerAddresses.bind(ctrl));
router.post('/eligible-nodes',                     canAccess, ctrl.eligibleNodes.bind(ctrl));
router.get('/delivery-slots',                      canAccess, ctrl.deliverySlots.bind(ctrl));
router.post('/calculate',                          canAccess, ctrl.calculate.bind(ctrl));
router.post('/create-order',                       canAccess, ctrl.createOrder.bind(ctrl));

module.exports = router;
