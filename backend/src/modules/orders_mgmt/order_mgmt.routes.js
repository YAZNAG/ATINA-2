const { Router } = require('express');
const ctrl = require('./order_mgmt.controller');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

const canView   = perm.permAny(['orders.view',  'dashboard.view']);
const canUpdate = perm.permAny(['orders.update_status', 'dashboard.view']);

router.get('/meta',                   canView,   ctrl.meta.bind(ctrl));
router.get('/',                       canView,   ctrl.index.bind(ctrl));
router.get('/:id',                    canView,   ctrl.show.bind(ctrl));
router.get('/:id/transitions',        canView,   ctrl.transitions.bind(ctrl));
router.get('/:id/history',            canView,   ctrl.history.bind(ctrl));
router.patch('/:id/status',           canUpdate, ctrl.changeStatus.bind(ctrl));
router.patch('/:id/cancel',           canUpdate, ctrl.cancel.bind(ctrl));
router.get('/:id/pickers',            canView,   ctrl.pickersForNode.bind(ctrl));
router.post('/:id/assign-picker',     canUpdate, ctrl.assignPicker.bind(ctrl));
router.patch('/:id/confirm-pickup',   canUpdate, ctrl.confirmPickup.bind(ctrl));

module.exports = router;
