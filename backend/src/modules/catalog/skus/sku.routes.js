const { Router } = require('express');
const ctrl = require('./sku.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

router.get('/', perm('skus.view'), ctrl.index.bind(ctrl));
router.post('/', perm('skus.create'), ctrl.store.bind(ctrl));
router.get('/:id', perm('skus.view'), ctrl.show.bind(ctrl));
router.delete('/:id', perm('skus.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;
