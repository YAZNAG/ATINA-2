const { Router } = require('express');
const ctrl = require('./customer_wallet.controller');
const auth = require('../../middlewares/customer_auth.middleware'); 

const router = Router();
router.use(auth);

router.get('/',             ctrl.getWallet.bind(ctrl));
router.get('/transactions', ctrl.getTransactions.bind(ctrl));

module.exports = router;