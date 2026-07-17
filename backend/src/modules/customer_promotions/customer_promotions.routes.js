const { Router }   = require('express');
const ctrl         = require('./customer_promotions.controller');
const customerAuth = require('../../middlewares/customer_auth.middleware');

const router = Router();
router.use(customerAuth);

router.get('/',           ctrl.list.bind(ctrl));
router.get('/best-deals', ctrl.bestDeals.bind(ctrl));
router.get('/ending-soon', ctrl.endingSoon.bind(ctrl));
router.get('/home', ctrl.homePromotions.bind(ctrl));
router.get('/:id',        ctrl.detail.bind(ctrl));

module.exports = router;
