const { Router } = require('express');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');
const ctrl = require('./reporting.controller');

/**
 * Reporting / Supervision (lecture seule) — monté sur /api/reporting.
 *
 *  KPI Overview (écran d'accueil)
 *    GET /filters                       listes node / région / famille / catégorie / marque / statuts
 *    GET /overview                      Vue Globale (cartes KPI, répartition statut, tendance)
 *    GET /overview/orders               onglet Commandes
 *    GET /overview/stock                onglet Stock & Rupture (node × SKU, paginé)
 *    GET /overview/preparation          onglet Préparation (sessions en cours / en retard)
 *      filtres : period=day|week|month ou from/to (AAAA-MM-JJ), node_id, region_id, status
 *
 *  Distribution Stock
 *    GET /stock-distribution/nodes      Couverture par Node
 *    GET /stock-distribution/skus       Couverture par SKU (paginé)
 *    GET /stock-distribution/alerts     Ruptures & Alertes (paginé)
 *    GET /stock-distribution/matrix     Heatmap node × SKU (SKU paginés)
 *    GET /stock-distribution/detail     Détail SKU × Node (niveaux + mouvements), sku_id requis
 *      filtres : node_id, region_id, family_id, category_id, brand_id, search, coverage_threshold (jours)
 *
 *  Historique (conservé) : /dashboard, /orders, /picking, /delivery, /stock, /payments
 */
const router = Router();
router.use(auth);
const canView = perm.permAny(['reporting.view', 'dashboard.view']);

router.get('/filters',                    canView, ctrl.filters.bind(ctrl));

router.get('/overview',                   canView, ctrl.overview.bind(ctrl));
router.get('/overview/orders',            canView, ctrl.overviewOrders.bind(ctrl));
router.get('/overview/stock',             canView, ctrl.overviewStock.bind(ctrl));
router.get('/overview/preparation',       canView, ctrl.overviewPreparation.bind(ctrl));

router.get('/stock-distribution/nodes',   canView, ctrl.coverageByNode.bind(ctrl));
router.get('/stock-distribution/skus',    canView, ctrl.coverageBySku.bind(ctrl));
router.get('/stock-distribution/alerts',  canView, ctrl.stockAlerts.bind(ctrl));
router.get('/stock-distribution/matrix',  canView, ctrl.stockMatrix.bind(ctrl));
router.get('/stock-distribution/detail',  canView, ctrl.stockDetail.bind(ctrl));

router.get('/dashboard', canView, ctrl.dashboard.bind(ctrl));
router.get('/orders',    canView, ctrl.orders.bind(ctrl));
router.get('/picking',   canView, ctrl.picking.bind(ctrl));
router.get('/delivery',  canView, ctrl.delivery.bind(ctrl));
router.get('/stock',     canView, ctrl.stock.bind(ctrl));
router.get('/payments',  canView, ctrl.payments.bind(ctrl));

module.exports = router;
