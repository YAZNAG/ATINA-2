const { Router } = require('express');
const ctrl = require('./customer_catalog.controller');
const customerAuth = require('../../middlewares/customer_auth.middleware');
const optionalCustomerAuth = require('../../middlewares/optional_customer_auth.middleware');

const router = Router();

// Routes publiques : token facultatif, utilisé pour choisir le node (prix / stock) du client.
router.get('/categories',                    optionalCustomerAuth, ctrl.categories.bind(ctrl));
// Onglet « Produits » : familles puis sous-familles (produits : /articles?family_id=&subfamily_id=)
router.get('/families',                      optionalCustomerAuth, ctrl.families.bind(ctrl));
router.get('/families/:id/subfamilies',      optionalCustomerAuth, ctrl.familySubfamilies.bind(ctrl));
router.get('/cart-complements',              optionalCustomerAuth, ctrl.cartComplements.bind(ctrl));
router.get('/top-rated',                     optionalCustomerAuth, ctrl.topRated.bind(ctrl));
router.get('/categories/:id/articles',       optionalCustomerAuth, ctrl.articlesByCategory.bind(ctrl));
router.get('/articles',                      optionalCustomerAuth, ctrl.searchArticles.bind(ctrl));
router.get('/popular',                       optionalCustomerAuth, ctrl.popular.bind(ctrl));
router.get('/articles/:id',                  optionalCustomerAuth, ctrl.articleDetail.bind(ctrl));
router.get('/cities',                        ctrl.cities.bind(ctrl));
// Points de distribution d'une ville (écran « Complétez votre profil »)
router.get('/nodes',                         ctrl.nodes.bind(ctrl));
router.get('/categories/:id/sub-categories', optionalCustomerAuth, ctrl.subCategories.bind(ctrl));
router.get('/recommendations', customerAuth, ctrl.recommendedArticles.bind(ctrl));

module.exports = router;
