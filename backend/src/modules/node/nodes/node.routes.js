const { Router } = require('express');
const ctrl = require('./node.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./node.validator');

const router = Router();
router.use(auth);

router.get('/', perm('nodes.view'), ctrl.index.bind(ctrl));
router.post('/', perm('nodes.create'), createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('nodes.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('nodes.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('nodes.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;
