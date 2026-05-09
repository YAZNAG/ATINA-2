const { Router } = require('express');

const router = Router();

router.use('/types', require('./delivery_types/delivery_type.routes'));

module.exports = router;
