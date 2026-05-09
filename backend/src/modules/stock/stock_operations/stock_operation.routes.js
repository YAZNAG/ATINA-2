const { Router } = require('express');
const ctrl = require('./stock_operation.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

router.get('/',     perm('stock.view'),   ctrl.list.bind(ctrl));
router.post('/seed', perm('stock.manage'), ctrl.seed.bind(ctrl));

module.exports = router;
