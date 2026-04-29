const { Router } = require('express');
const ctrl = require('./unit.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./unit.validator');

const router = Router();
router.use(auth);

router.get('/', perm('units.view'), ctrl.index.bind(ctrl));
router.post('/', perm('units.create'), createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('units.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('units.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('units.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;
