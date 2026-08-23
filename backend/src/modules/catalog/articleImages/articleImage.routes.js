const { Router } = require('express');
const ctrl = require('./articleImage.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createUpload } = require('../../../middlewares/upload.middleware');

const router = Router({ mergeParams: true });
router.use(auth);

const upload = createUpload('skus', [{ name: 'images', maxCount: 10 }]);

router.get('/', perm('skus.view'), ctrl.index.bind(ctrl));
router.post('/', perm('sku_images.manage'), upload, ctrl.addImages.bind(ctrl));
router.patch('/:imageId/main', perm('sku_images.manage'), ctrl.setPrimary.bind(ctrl));
router.patch('/:imageId/sort', perm('sku_images.manage'), ctrl.updateSort.bind(ctrl));
router.delete('/:imageId', perm('sku_images.manage'), ctrl.destroy.bind(ctrl));

module.exports = router;