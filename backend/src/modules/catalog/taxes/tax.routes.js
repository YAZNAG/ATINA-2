const { Router } = require('express');
const ctrl = require('./tax.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./tax.validator');

const router = Router();
router.use(auth);

router.get('/', perm('taxes.view'), ctrl.index.bind(ctrl));
router.post('/', perm('taxes.create'), createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('taxes.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('taxes.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('taxes.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;
