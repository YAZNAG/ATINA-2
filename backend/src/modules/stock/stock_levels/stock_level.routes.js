const { Router } = require('express');
const ctrl = require('./stock_level.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

router.get('/',         perm('stock.view'),   ctrl.byNode.bind(ctrl));
router.post('/move',    perm('stock.manage'), ctrl.applyMove.bind(ctrl));
router.post('/adjust',  perm('stock.manage'), ctrl.adjust.bind(ctrl));

module.exports = router;
