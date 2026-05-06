const { Router } = require('express');

const router = Router();

router.use('/zones', require('./zones/zone.routes'));
router.use('/levels', require('./levels/level.routes'));
router.use('/locations', require('./locations/location.routes'));
router.use('/sku-locations', require('./skuLocations/skuLocation.routes'));

module.exports = router;
