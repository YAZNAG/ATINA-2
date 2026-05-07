const { Router } = require('express');

const router = Router();

router.use('/move-types', require('./move_types/move_type.routes'));

module.exports = router;
