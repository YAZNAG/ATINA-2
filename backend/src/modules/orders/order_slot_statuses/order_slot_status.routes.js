const { Router } = require('express');
const ctrl = require('./order_slot_status.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

router.get('/',       perm('dashboard.view'), ctrl.index.bind(ctrl));
router.get('/:id',    perm('dashboard.view'), ctrl.show.bind(ctrl));
router.post('/seed',  perm('dashboard.view'), ctrl.seedData.bind(ctrl));
router.post('/',      perm('dashboard.view'), ctrl.store.bind(ctrl));
router.put('/:id',    perm('dashboard.view'), ctrl.update.bind(ctrl));
router.delete('/:id', perm('dashboard.view'), ctrl.destroy.bind(ctrl));

module.exports = router;
