const { Router } = require('express');
const ctrl = require('./customer_catalog.controller');
const customerAuth = require('../../middlewares/customer_auth.middleware');

const router = Router();


router.get('/categories',                 ctrl.categories.bind(ctrl));
router.get('/cart-complements',           ctrl.cartComplements.bind(ctrl));
router.get('/top-rated',                  ctrl.topRated.bind(ctrl));
router.get('/categories/:id/articles',    ctrl.articlesByCategory.bind(ctrl));
router.get('/articles',                   ctrl.searchArticles.bind(ctrl));
router.get('/popular',                    ctrl.popular.bind(ctrl));
router.get('/articles/:id',               ctrl.articleDetail.bind(ctrl));
router.get('/cities',                     ctrl.cities.bind(ctrl));
router.get('/categories/:id/sub-categories', ctrl.subCategories.bind(ctrl));
router.get('/recommendations', customerAuth, ctrl.recommendedArticles.bind(ctrl));


module.exports = router;
