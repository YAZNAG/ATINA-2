const { Router } = require('express');
const ctrl = require('./picking.controller');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

const canView   = perm.permAny(['picking.view',   'dashboard.view']);
const canUpdate = perm.permAny(['picking.update',  'dashboard.view']);

router.get('/pickers',              canView,   ctrl.listPickers.bind(ctrl));
router.get('/sessions',             canView,   ctrl.listSessions.bind(ctrl));
router.post('/sessions',            canUpdate, ctrl.createSession.bind(ctrl));
router.get('/sessions/:id',         canView,   ctrl.getSession.bind(ctrl));
router.patch('/sessions/:id/start',    canUpdate, ctrl.startSession.bind(ctrl));
router.patch('/sessions/:id/complete', canUpdate, ctrl.completeSession.bind(ctrl));
router.patch('/sessions/:id/cancel',   canUpdate, ctrl.cancelSession.bind(ctrl));
router.patch('/sessions/:id/picker',   canUpdate, ctrl.assignPicker.bind(ctrl));
router.patch('/items/:id/pick',        canUpdate, ctrl.pickItem.bind(ctrl));
router.patch('/items/:id/substitute',  canUpdate, ctrl.substituteItem.bind(ctrl));
router.patch('/items/:id/out-of-stock',canUpdate, ctrl.outOfStock.bind(ctrl));

module.exports = router;
