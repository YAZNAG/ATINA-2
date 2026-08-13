const { Router } = require('express');
const ctrl = require('./packagingType.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./packagingType.validator');

const router = Router();
router.use(auth);

router.get('/', perm('packaging_types.view'), ctrl.index.bind(ctrl));
router.post('/', perm('packaging_types.create'), createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('packaging_types.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('packaging_types.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('packaging_types.delete'), ctrl.destroy.bind(ctrl));
router.patch('/:id/restore', perm('packaging_types.delete'), ctrl.restore.bind(ctrl));

module.exports = router;