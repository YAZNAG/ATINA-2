const { Router } = require('express');
const ctrl = require('./pack.controller');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');

const canView   = perm.permAny(['packs.view',   'dashboard.view']);
const canCreate = perm.permAny(['packs.create', 'dashboard.view']);
const canUpdate = perm.permAny(['packs.update', 'dashboard.view']);
const canDelete = perm.permAny(['packs.delete', 'dashboard.view']);

const router = Router();
router.use(auth);

router.get('/',                 canView,   ctrl.index.bind(ctrl));
router.get('/:id',              canView,   ctrl.show.bind(ctrl));
router.post('/',                canCreate, ctrl.store.bind(ctrl));
router.post('/:id/duplicate',   canCreate, ctrl.duplicate.bind(ctrl));
router.put('/:id',              canUpdate, ctrl.update.bind(ctrl));
router.delete('/:id',           canDelete, ctrl.destroy.bind(ctrl));

module.exports = router;