const { Router } = require('express');
const ctrl       = require('./customer_coupons.controller');
const customerAuth = require('../../middlewares/customer_auth.middleware');

const router = Router();
router.use(customerAuth);

router.post('/validate', ctrl.validate.bind(ctrl));
router.get('/',          ctrl.list.bind(ctrl));

module.exports = router;