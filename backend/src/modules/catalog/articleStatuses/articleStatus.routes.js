const { Router } = require('express');
const ctrl = require('./articleStatus.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./articleStatus.validator');

const router = Router();
router.use(auth);

router.get('/', perm('article_statuses.view'), ctrl.index.bind(ctrl));
router.post('/', perm('article_statuses.create'), createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('article_statuses.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('article_statuses.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('article_statuses.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;
