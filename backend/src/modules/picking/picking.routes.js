const { Router } = require('express');
const ctrl       = require('./picking.controller');
const psCtrl     = require('./picking_statuses/picking_status.controller');
const pisCtrl    = require('./pick_item_statuses/pick_item_status.controller');
const auth       = require('../../middlewares/auth.middleware');
const perm       = require('../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

const canView    = perm.permAny(['picking.read','picking.view','dashboard.view']);
const canManage  = perm.permAny(['picking.update','dashboard.view']);
const canCfg     = perm.permAny(['dashboard.view']);

// Statuts picking
router.get('/statuses',         canCfg, psCtrl.index.bind(psCtrl));
router.post('/statuses/seed',   canCfg, psCtrl.seedData.bind(psCtrl));
router.post('/statuses',        canCfg, psCtrl.store.bind(psCtrl));
router.get('/statuses/:id',     canCfg, psCtrl.show.bind(psCtrl));
router.put('/statuses/:id',     canCfg, psCtrl.update.bind(psCtrl));
router.delete('/statuses/:id',  canCfg, psCtrl.destroy.bind(psCtrl));

// Statuts articles picking
router.get('/item-statuses',        canCfg, pisCtrl.index.bind(pisCtrl));
router.post('/item-statuses/seed',  canCfg, pisCtrl.seedData.bind(pisCtrl));
router.post('/item-statuses',       canCfg, pisCtrl.store.bind(pisCtrl));
router.get('/item-statuses/:id',    canCfg, pisCtrl.show.bind(pisCtrl));
router.put('/item-statuses/:id',    canCfg, pisCtrl.update.bind(pisCtrl));
router.delete('/item-statuses/:id', canCfg, pisCtrl.destroy.bind(pisCtrl));

// Opérationnel
router.get('/pickers',               canView,   ctrl.listPickers.bind(ctrl));
router.get('/sessions',              canView,   ctrl.listSessions.bind(ctrl));
router.post('/sessions',             canManage, ctrl.createSession.bind(ctrl));
router.get('/sessions/:id',          canView,   ctrl.getSession.bind(ctrl));
router.patch('/sessions/:id/start',    canManage, ctrl.startSession.bind(ctrl));
router.patch('/sessions/:id/complete', canManage, ctrl.completeSession.bind(ctrl));
router.patch('/sessions/:id/cancel',   canManage, ctrl.cancelSession.bind(ctrl));
router.patch('/sessions/:id/picker',   canManage, ctrl.assignPicker.bind(ctrl));
router.patch('/items/:id/pick',        canManage, ctrl.pickItem.bind(ctrl));
router.patch('/items/:id/substitute',  canManage, ctrl.substituteItem.bind(ctrl));
router.patch('/items/:id/out-of-stock',canManage, ctrl.outOfStock.bind(ctrl));

module.exports = router;
