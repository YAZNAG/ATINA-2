const { Router } = require('express');
const ctrl = require('./coupons.controller');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');

// coupons.view / coupons.manage (+ dashboard.view : accès historique conservé)
const canView   = perm.permAny(['coupons.view', 'coupons.manage', 'dashboard.view']);
const canManage = perm.permAny(['coupons.manage', 'dashboard.view']);

const router = Router();
router.use(auth);

// Référentiels & suivi (avant /:id)
router.get('/lookups',                     canView,   ctrl.lookups.bind(ctrl));
router.get('/customers',                   canView,   ctrl.customers.bind(ctrl));
router.get('/redemptions',                 canView,   ctrl.redemptions.bind(ctrl));
router.get('/redemptions/:orderId',        canView,   ctrl.redemptionOrder.bind(ctrl));

router.get('/',                            canView,   ctrl.index.bind(ctrl));
router.get('/:id',                         canView,   ctrl.show.bind(ctrl));
router.get('/:id/deletion-check',          canView,   ctrl.deletionCheck.bind(ctrl));
router.post('/',                           canManage, ctrl.store.bind(ctrl));
router.put('/:id',                         canManage, ctrl.update.bind(ctrl));
router.patch('/:id/status',                canManage, ctrl.setStatus.bind(ctrl));
router.delete('/:id',                      canManage, ctrl.destroy.bind(ctrl));

module.exports = router;
