const { Router } = require('express');

const router = Router();

router.use('/families', require('./families/family.routes'));
router.use('/categories', require('./categories/category.routes'));
router.use('/sub-categories', require('./subCategories/subCategory.routes'));
router.use('/brands', require('./brands/brand.routes'));
router.use('/units', require('./units/unit.routes'));
router.use('/packaging-types', require('./packagingTypes/packagingType.routes'));
router.use('/conservation-types', require('./conservationTypes/conservationType.routes'));
router.use('/article-types', require('./articleTypes/articleType.routes'));
router.use('/article-statuses', require('./articleStatuses/articleStatus.routes'));
router.use('/taxes', require('./taxes/tax.routes'));
router.use('/articles/:articleId/sku-images', require('./articleSkuImages/articleSkuImage.routes'));
router.use('/articles/:articleId/images', require('./articleImages/articleImage.routes'));
router.use('/articles', require('./articles/article.routes'));
router.use('/skus', require('./skus/sku.routes'));
router.use('/sku-images', require('./skuImages/skuImage.routes'));

module.exports = router;
