const { Router } = require('express');
const ctrl = require('./points_exchange.controller');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');

const canView   = perm.permAny(['points_exchange.view', 'points_exchange.manage']);
const canManage = perm('points_exchange.manage');

const router = Router();
router.use(auth);

router.get('/',                 canView,   ctrl.index.bind(ctrl));
router.get('/eligible-skus',    canView,   ctrl.eligibleSkus.bind(ctrl));
router.get('/exchanges',        canView,   ctrl.exchanges.bind(ctrl));
router.get('/:id',              canView,   ctrl.show.bind(ctrl));
router.post('/',                canManage, ctrl.store.bind(ctrl));
router.put('/:id',              canManage, ctrl.update.bind(ctrl));
router.patch('/:id/activate',   canManage, ctrl.activate.bind(ctrl));
router.patch('/:id/deactivate', canManage, ctrl.deactivate.bind(ctrl));
router.post('/:id/duplicate',   canManage, ctrl.duplicate.bind(ctrl));
router.delete('/:id',           canManage, ctrl.destroy.bind(ctrl));

module.exports = router;
