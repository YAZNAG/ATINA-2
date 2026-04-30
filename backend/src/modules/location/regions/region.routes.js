const { Router } = require('express');
const ctrl = require('./region.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./region.validator');

const router = Router();
router.use(auth);

router.get('/', perm('regions.view'), ctrl.index.bind(ctrl));
router.post('/', perm('regions.create'), createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('regions.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('regions.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('regions.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;
