const { Router } = require('express');
const ctrl = require('./picker.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

const canRead   = perm.permAny(['pickers.read',   'dashboard.view']);
const canCreate = perm.permAny(['pickers.create',  'dashboard.view']);
const canUpdate = perm.permAny(['pickers.update',  'pickers.activate', 'pickers.deactivate', 'pickers.reset_password', 'dashboard.view']);
const canDelete = perm.permAny(['pickers.delete',  'dashboard.view']);

router.get('/',                         canRead,   ctrl.index.bind(ctrl));
router.post('/',                        canCreate, ctrl.store.bind(ctrl));
router.get('/:id',                      canRead,   ctrl.show.bind(ctrl));
router.put('/:id',                      canUpdate, ctrl.update.bind(ctrl));
router.patch('/:id/activate',           canUpdate, ctrl.activate.bind(ctrl));
router.patch('/:id/deactivate',         canUpdate, ctrl.deactivate.bind(ctrl));
router.patch('/:id/reset-password',     canUpdate, ctrl.resetPassword.bind(ctrl));
router.delete('/:id',               canDelete, ctrl.destroy.bind(ctrl));
router.get('/:id/stats',            canRead,   ctrl.stats.bind(ctrl));
router.get('/:id/sessions',         canRead,   ctrl.sessions.bind(ctrl));
router.get('/:id/orders',           canRead,   ctrl.orders.bind(ctrl));

module.exports = router;
