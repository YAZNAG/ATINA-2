const { Router } = require('express');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');
const ctrl = require('./customer.controller');
const { createValidator, updateValidator, uuidParam } = require('./customer.validation');

const router = Router();
router.use(auth);

const canView = perm.permAny(['customers.view', 'dashboard.view']);
const canCreate = perm.permAny(['customers.create', 'dashboard.view']);
const canUpdate = perm.permAny(['customers.update', 'dashboard.view']);
const canDelete = perm.permAny(['customers.delete', 'dashboard.view']);

router.get('/', canView, ctrl.index.bind(ctrl));
router.post('/', canCreate, createValidator, ctrl.store.bind(ctrl));

router.put('/:id/block', canUpdate, ...uuidParam, ctrl.block.bind(ctrl));
router.put('/:id/unblock', canUpdate, ...uuidParam, ctrl.unblock.bind(ctrl));

router.put('/:id', canUpdate, ...uuidParam, updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', canDelete, ...uuidParam, ctrl.destroy.bind(ctrl));
router.get('/:id', canView, ...uuidParam, ctrl.show.bind(ctrl));

module.exports = router;
