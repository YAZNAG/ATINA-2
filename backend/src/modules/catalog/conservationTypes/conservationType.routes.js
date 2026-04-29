const { Router } = require('express');
const ctrl = require('./conservationType.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./conservationType.validator');

const router = Router();
router.use(auth);

router.get('/', perm('conservation_types.view'), ctrl.index.bind(ctrl));
router.post('/', perm('conservation_types.create'), createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('conservation_types.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('conservation_types.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('conservation_types.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;
