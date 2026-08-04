const { Router } = require('express');
const ctrl = require('./customer_loyalty.controller');
const customerAuth = require('../../middlewares/customer_auth.middleware');

const router = Router();

router.get('/summary', customerAuth, ctrl.getSummary);
router.get('/history', customerAuth, ctrl.getHistory);
router.post('/redeem', customerAuth, ctrl.redeem);

module.exports = router;