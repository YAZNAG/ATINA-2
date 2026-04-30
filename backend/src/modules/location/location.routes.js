const { Router } = require('express');

const router = Router();

router.use('/regions', require('./regions/region.routes'));
router.use('/provinces', require('./provinces/province.routes'));
router.use('/cities', require('./cities/city.routes'));

module.exports = router;
