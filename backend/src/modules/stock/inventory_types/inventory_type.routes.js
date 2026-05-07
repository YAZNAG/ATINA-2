const { Router } = require('express');
const ctrl = require('./inventory_type.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

router.get('/',       perm('stock.view'),   ctrl.index.bind(ctrl));
router.post('/',      perm('stock.manage'), ctrl.store.bind(ctrl));
router.get('/:id',    perm('stock.view'),   ctrl.show.bind(ctrl));
router.put('/:id',    perm('stock.manage'), ctrl.update.bind(ctrl));
router.delete('/:id', perm('stock.manage'), ctrl.destroy.bind(ctrl));

module.exports = router;
