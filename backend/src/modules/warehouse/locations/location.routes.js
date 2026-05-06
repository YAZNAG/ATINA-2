const { Router } = require('express');
const ctrl = require('./location.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

router.get('/', perm('warehouse.view'), ctrl.index.bind(ctrl));
router.post('/', perm('warehouse.manage'), ctrl.store.bind(ctrl));
router.post('/bulk-generate', perm('warehouse.manage'), ctrl.bulkGenerate.bind(ctrl));
router.get('/:id', perm('warehouse.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('warehouse.manage'), ctrl.update.bind(ctrl));
router.delete('/:id', perm('warehouse.manage'), ctrl.destroy.bind(ctrl));

module.exports = router;
