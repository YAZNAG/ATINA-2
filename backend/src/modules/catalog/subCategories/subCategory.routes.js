/**
 * Routes sous-catégories — module retiré (table `sub_categories` supprimée).
 * GET / renvoie une liste vide ; toutes les autres routes répondent 410 Gone,
 * sans upload ni validation préalable.
 */
const { Router } = require('express');
const ctrl = require('./subCategory.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

router.get('/', perm('sub_categories.view'), ctrl.index.bind(ctrl));
router.post('/', perm('sub_categories.create'), ctrl.store.bind(ctrl));
router.get('/:id', perm('sub_categories.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('sub_categories.update'), ctrl.update.bind(ctrl));
router.delete('/:id', perm('sub_categories.delete'), ctrl.destroy.bind(ctrl));
router.patch('/:id/restore', perm('sub_categories.delete'), ctrl.restore.bind(ctrl));

module.exports = router;
