const { Router } = require('express');
const ctrl = require('./article.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./article.validator');

const router = Router();
router.use(auth);

router.get('/', perm('articles.view'), ctrl.index.bind(ctrl));
router.post('/', perm('articles.create'), createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('articles.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('articles.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('articles.delete'), ctrl.destroy.bind(ctrl));
router.patch('/:id/toggle-status', perm('articles.update'), ctrl.toggleStatus.bind(ctrl));
router.patch('/:id/restore', perm('articles.delete'), ctrl.restore.bind(ctrl));

module.exports = router;
