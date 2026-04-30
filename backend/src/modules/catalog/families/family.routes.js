const { Router } = require('express');
const ctrl = require('./family.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./family.validator');

const router = Router();
router.use(auth);

router.get('/', perm('families.view'), ctrl.index.bind(ctrl));
router.post('/', perm('families.create'), createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('families.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('families.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('families.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;
