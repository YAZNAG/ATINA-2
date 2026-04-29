const { Router } = require('express');
const ctrl = require('./articleType.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./articleType.validator');

const router = Router();
router.use(auth);

router.get('/', perm('article_types.view'), ctrl.index.bind(ctrl));
router.post('/', perm('article_types.create'), createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('article_types.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('article_types.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('article_types.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;
