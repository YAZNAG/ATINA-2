const { Router } = require('express');
const ctrl = require('./stock_move.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

router.get('/stats', perm('stock.view'), ctrl.stats.bind(ctrl));
router.get('/',      perm('stock.view'), ctrl.list.bind(ctrl));
router.get('/:id',   perm('stock.view'), ctrl.getById.bind(ctrl));

module.exports = router;
