const { Router } = require('express');

const router = Router();

router.use('/families', require('./families/family.routes'));
router.use('/subfamilies', require('./subFamily/subfamily.route'));
router.use('/categories', require('./categories/category.routes'));
router.use('/brands', require('./brands/brand.routes'));
router.use('/units', require('./units/unit.routes'));
router.use('/packaging-types', require('./packagingTypes/packagingType.routes'));
router.use('/conservation-types', require('./conservationTypes/conservationType.routes'));
router.use('/taxes', require('./taxes/tax.routes'));
router.use('/articles/:articleId/sku-images', require('./articleSkuImages/articleSkuImage.routes'));
router.use('/skus/:skuId/images', require('./skuImages/skuImage.routes'));
router.use('/skus', require('./skus/sku.routes'));

module.exports = router;