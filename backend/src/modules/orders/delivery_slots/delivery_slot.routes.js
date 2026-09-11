const { Router } = require('express');
const ctrl = require('./delivery_slot.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

const canView   = perm.permAny(['delivery_slots.view', 'orders.view', 'dashboard.view']);
const canCreate = perm.permAny(['delivery_slots.create', 'dashboard.view']);
const canUpdate = perm.permAny(['delivery_slots.update', 'dashboard.view']);
const canDelete = perm.permAny(['delivery_slots.delete', 'dashboard.view']);

router.get('/',       canView,   ctrl.index.bind(ctrl));
router.post('/bulk',  canCreate, ctrl.bulk.bind(ctrl));
router.get('/:id',    canView,   ctrl.show.bind(ctrl));
router.post('/',      canCreate, ctrl.store.bind(ctrl));
router.put('/:id',    canUpdate, ctrl.update.bind(ctrl));
router.patch('/:id',  canUpdate, ctrl.update.bind(ctrl));
router.delete('/:id', canDelete, ctrl.destroy.bind(ctrl));

module.exports = router;
