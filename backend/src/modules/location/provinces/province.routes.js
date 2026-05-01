const { Router } = require('express');
const ctrl = require('./province.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./province.validator');

const router = Router();
router.use(auth);

router.get('/', perm('provinces.view'), ctrl.index.bind(ctrl));
router.post('/', perm('provinces.create'), createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('provinces.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('provinces.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('provinces.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;
