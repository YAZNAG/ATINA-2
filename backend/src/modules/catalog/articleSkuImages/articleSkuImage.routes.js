const { Router } = require('express');
const ctrl = require('./articleSkuImage.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
// Qui peut modifier l’article peut gérer sa galerie (évite 403 si les droits sku_images.* ne sont pas assignés).
const skuImgUploadPerms = ['sku_images.create', 'article_images.manage', 'articles.update'];
const skuImgUpdatePerms = ['sku_images.update', 'article_images.manage', 'articles.update'];
const skuImgDeletePerms = ['sku_images.delete', 'article_images.manage', 'articles.update'];
const { createUploadArticleSkuImages } = require('../../../middlewares/upload.middleware');

const router = Router({ mergeParams: true });
router.use(auth);

const upload = createUploadArticleSkuImages([{ name: 'images', maxCount: 10 }]);

router.get('/', perm('articles.view'), ctrl.index.bind(ctrl));
router.post('/', perm.permAny(skuImgUploadPerms), upload, ctrl.addImages.bind(ctrl));
router.patch('/:imageId/primary', perm.permAny(skuImgUpdatePerms), ctrl.setPrimary.bind(ctrl));
router.patch('/:imageId/sort', perm.permAny(skuImgUpdatePerms), ctrl.updateSort.bind(ctrl));
router.delete('/:imageId', perm.permAny(skuImgDeletePerms), ctrl.destroy.bind(ctrl));

module.exports = router;
