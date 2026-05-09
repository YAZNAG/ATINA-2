const { Router } = require('express');
const ctrl = require('./stock_lot.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

router.get('/alerts', perm('stock.view'),   ctrl.alerts.bind(ctrl));
router.get('/',       perm('stock.view'),   ctrl.list.bind(ctrl));
router.get('/:id',    perm('stock.view'),   ctrl.getById.bind(ctrl));
router.post('/',      perm('stock.manage'), ctrl.create.bind(ctrl));
router.delete('/:id', perm('stock.manage'), ctrl.remove.bind(ctrl));

module.exports = router;
