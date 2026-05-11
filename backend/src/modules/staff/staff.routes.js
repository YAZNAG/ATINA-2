const { Router } = require('express');
const router = Router();

router.use('/pickers', require('./pickers/picker.routes'));
router.use('/drivers', require('./drivers/driver.routes'));

module.exports = router;
