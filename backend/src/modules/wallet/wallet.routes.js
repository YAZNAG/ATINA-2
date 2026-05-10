const { Router } = require('express');

const router = Router();

router.use('/txn-types', require('./wallet_txn_types/wallet_txn_type.routes'));

module.exports = router;
