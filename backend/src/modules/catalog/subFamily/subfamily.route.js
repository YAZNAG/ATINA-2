const { Router } = require('express');
const ctrl = require('./subfamily.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./subfamily.validator');

const router = Router();
router.use(auth);

router.patch('/reorder', perm('subfamilies.update'), ctrl.reorder.bind(ctrl));
router.get('/', perm('subfamilies.view'), ctrl.index.bind(ctrl));
router.post('/', perm('subfamilies.create'), createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('subfamilies.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('subfamilies.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('subfamilies.delete'), ctrl.destroy.bind(ctrl));
router.patch('/:id/toggle-status', perm('subfamilies.update'), ctrl.toggleStatus.bind(ctrl));
router.patch('/:id/restore', perm('subfamilies.delete'), ctrl.restore.bind(ctrl));

module.exports = router;