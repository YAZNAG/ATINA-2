const { Router } = require('express');
const ctrl = require('./articleSkuImage.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const skuImgUploadPerms = ['sku_images.create', 'article_images.manage'];
const skuImgUpdatePerms = ['sku_images.update', 'article_images.manage'];
const skuImgDeletePerms = ['sku_images.delete', 'article_images.manage'];
const { createUpload } = require('../../../middlewares/upload.middleware');

const router = Router({ mergeParams: true });
router.use(auth);

const upload = createUpload('sku-images', [{ name: 'images', maxCount: 10 }]);

router.get('/', perm('articles.view'), ctrl.index.bind(ctrl));
router.post('/', perm.permAny(skuImgUploadPerms), upload, ctrl.addImages.bind(ctrl));
router.patch('/:imageId/primary', perm.permAny(skuImgUpdatePerms), ctrl.setPrimary.bind(ctrl));
router.patch('/:imageId/sort', perm.permAny(skuImgUpdatePerms), ctrl.updateSort.bind(ctrl));
router.delete('/:imageId', perm.permAny(skuImgDeletePerms), ctrl.destroy.bind(ctrl));

module.exports = router;
