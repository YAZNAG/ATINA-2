const { Router } = require('express');

const router = Router();

router.use('/move-types',      require('./move_types/move_type.routes'));
router.use('/stock-statuses',  require('./stock_statuses/stock_status.routes'));
router.use('/inventory-types',    require('./inventory_types/inventory_type.routes'));
router.use('/inventory-statuses', require('./inventory_statuses/inventory_status.routes'));

module.exports = router;
