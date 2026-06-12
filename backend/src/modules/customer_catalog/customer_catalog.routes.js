const { Router } = require('express');
const ctrl = require('./customer_catalog.controller');
const customerAuth = require('../../middlewares/customer_auth.middleware');

const router = Router();

// All public — no auth required
router.get('/categories',                 ctrl.categories.bind(ctrl));
router.get('/categories/:id/articles',    ctrl.articlesByCategory.bind(ctrl));
router.get('/articles',                   ctrl.searchArticles.bind(ctrl));
router.get('/articles/:id',               ctrl.articleDetail.bind(ctrl));
router.get('/cities',                     ctrl.cities.bind(ctrl));
router.get('/categories/:id/sub-categories', ctrl.subCategories.bind(ctrl));

// ── Routes protégées (client authentifié) ────────────────────────────────────
router.get('/recommendations', customerAuth, ctrl.recommendedArticles.bind(ctrl));


module.exports = router;
