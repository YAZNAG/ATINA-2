const { Router } = require('express');

const router = Router();

router.use('/move-types',      require('./move_types/move_type.routes'));
router.use('/stock-statuses',  require('./stock_statuses/stock_status.routes'));
router.use('/inventory-types',    require('./inventory_types/inventory_type.routes'));
router.use('/inventory-statuses', require('./inventory_statuses/inventory_status.routes'));
router.use('/inventory-gap-types', require('./inventory_gap_types/inventory_gap_type.routes'));
router.use('/thresholds',          require('./stock_threshold_rules/stock_threshold_rule.routes'));
router.use('/levels',              require('./stock_levels/stock_level.routes'));
router.use('/selling-rules',       require('./selling_rules/selling_rule.routes'));
router.use('/reorder-rules',       require('./reorder_rules/reorder_rule.routes'));

module.exports = router;
