const { Router } = require('express');
const ctrl = require('./family.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./family.validator');

const router = Router();
router.use(auth);

router.patch('/reorder', perm('families.update'), ctrl.reorder.bind(ctrl));
router.get('/', perm('families.view'), ctrl.index.bind(ctrl));
router.post('/', perm('families.create'), createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('families.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('families.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('families.delete'), ctrl.destroy.bind(ctrl));
router.patch('/:id/toggle-status', perm('families.update'), ctrl.toggleStatus.bind(ctrl));
router.patch('/:id/restore', perm('families.delete'), ctrl.restore.bind(ctrl));

module.exports = router;