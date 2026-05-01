const { Router } = require('express');
const ctrl = require('./nodeType.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./nodeType.validator');

const router = Router();
router.use(auth);

router.get('/', perm('node_types.view'), ctrl.index.bind(ctrl));
router.post('/', perm('node_types.create'), createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('node_types.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('node_types.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('node_types.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;
