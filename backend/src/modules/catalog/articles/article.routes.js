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

module.exports = router;
