const { Router } = require('express');
const ctrl = require('./skuImage.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./skuImage.validator');

const router = Router();
router.use(auth);

router.get('/', perm('sku_images.view'), ctrl.index.bind(ctrl));
router.post('/', perm('sku_images.create'), createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('sku_images.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('sku_images.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('sku_images.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;
