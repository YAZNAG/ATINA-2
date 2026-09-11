const { Router } = require('express');
const ctrl = require('./customer_catalog.controller');
const customerAuth = require('../../middlewares/customer_auth.middleware');
const optionalCustomerAuth = require('../../middlewares/optional_customer_auth.middleware');

const router = Router();

// Routes publiques : token facultatif, utilisé pour choisir le node (prix / stock) du client.
router.get('/categories',                    optionalCustomerAuth, ctrl.categories.bind(ctrl));
router.get('/cart-complements',              optionalCustomerAuth, ctrl.cartComplements.bind(ctrl));
router.get('/top-rated',                     optionalCustomerAuth, ctrl.topRated.bind(ctrl));
router.get('/categories/:id/articles',       optionalCustomerAuth, ctrl.articlesByCategory.bind(ctrl));
router.get('/articles',                      optionalCustomerAuth, ctrl.searchArticles.bind(ctrl));
router.get('/popular',                       optionalCustomerAuth, ctrl.popular.bind(ctrl));
router.get('/articles/:id',                  optionalCustomerAuth, ctrl.articleDetail.bind(ctrl));
router.get('/cities',                        ctrl.cities.bind(ctrl));
router.get('/categories/:id/sub-categories', optionalCustomerAuth, ctrl.subCategories.bind(ctrl));
router.get('/recommendations', customerAuth, ctrl.recommendedArticles.bind(ctrl));

module.exports = router;
