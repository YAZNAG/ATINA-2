const { Router } = require('express');
const ctrl = require('./sku.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./sku.validator');

const router = Router();
router.use(auth);

router.get('/', perm('skus.view'), ctrl.index.bind(ctrl));
router.post('/', perm('skus.create'), createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('skus.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('skus.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('skus.delete'), ctrl.destroy.bind(ctrl));
router.patch('/:id/toggle-status', perm('skus.update'), ctrl.toggleStatus.bind(ctrl));
router.patch('/:id/restore', perm('skus.delete'), ctrl.restore.bind(ctrl));

module.exports = router;