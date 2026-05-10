const { Router } = require('express');

const router = Router();

router.use('/statuses', require('./payment_statuses/payment_status.routes'));
router.use('/methods',  require('./payment_methods/payment_method.routes'));

module.exports = router;
