const { Router } = require('express');

const router = Router();

router.use('/statuses',      require('./order_statuses/order_status.routes'));
router.use('/item-statuses', require('./order_item_statuses/order_item_status.routes'));
router.use('/slot-statuses', require('./order_slot_statuses/order_slot_status.routes'));

module.exports = router;
