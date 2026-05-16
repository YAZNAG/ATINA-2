const { Router } = require('express');
const ctrl = require('./customer_catalog.controller');

const router = Router();

// All public — no auth required
router.get('/categories',                 ctrl.categories.bind(ctrl));
router.get('/categories/:id/articles',    ctrl.articlesByCategory.bind(ctrl));
router.get('/articles',                   ctrl.searchArticles.bind(ctrl));
router.get('/articles/:id',               ctrl.articleDetail.bind(ctrl));
router.get('/cities',                     ctrl.cities.bind(ctrl));

module.exports = router;
