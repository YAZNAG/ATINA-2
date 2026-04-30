const { Router } = require('express');
const ctrl = require('./subCategory.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./subCategory.validator');

const router = Router();
router.use(auth);

router.get('/', perm('sub_categories.view'), ctrl.index.bind(ctrl));
router.post('/', perm('sub_categories.create'), createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('sub_categories.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('sub_categories.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('sub_categories.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;
