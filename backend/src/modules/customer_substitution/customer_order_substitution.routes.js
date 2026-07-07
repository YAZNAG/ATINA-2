const { Router }   = require('express');
const ctrl         = require('./customer_substitution.controller');
const customerAuth = require('../../middlewares/customer_auth.middleware');

const router = Router();
router.use(customerAuth);

// GET /customer/orders/:orderId/substitutions
router.get('/:orderId/substitutions', ctrl.getOrderSubstitutions.bind(ctrl));

module.exports = router;