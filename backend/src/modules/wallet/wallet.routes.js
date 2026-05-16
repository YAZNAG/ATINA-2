const { Router } = require('express');
const ctrl = require('./wallet.controller');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

const canView   = perm.permAny(['wallet.view',   'dashboard.view']);
const canManage = perm.permAny(['wallet.manage',  'dashboard.view']);

router.use('/txn-types', require('./wallet_txn_types/wallet_txn_type.routes'));

router.get('/transactions',                canView,   ctrl.listTransactions.bind(ctrl));
router.get('/customers/:customerId',       canView,   ctrl.getCustomer.bind(ctrl));
router.post('/credit',                     canManage, ctrl.credit.bind(ctrl));
router.post('/debit',                      canManage, ctrl.debit.bind(ctrl));
router.post('/refund',                     canManage, ctrl.refund.bind(ctrl));

module.exports = router;
