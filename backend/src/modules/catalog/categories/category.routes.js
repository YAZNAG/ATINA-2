const { Router } = require('express');
const ctrl = require('./category.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./category.validator');

const router = Router();
router.use(auth);

router.get('/', perm('categories.view'), ctrl.index.bind(ctrl));
router.post('/', perm('categories.create'), createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('categories.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('categories.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('categories.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;
