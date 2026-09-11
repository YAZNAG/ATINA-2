/**
 * Achats & Fournisseurs — monté sur /purchasing (voir routes/index.js).
 *
 *  /purchasing/lookups                         référentiels des formulaires
 *  /purchasing/lookups/skus?search=            recherche SKU (repli sans skus.view)
 *  /purchasing/suppliers                       CRUD fournisseurs (soft-delete)
 *  /purchasing/supplier-prices                 grille prix fournisseur × SKU (paliers, validité)
 *  /purchasing/purchase-orders                 bons de commande + lignes
 *  /purchasing/purchase-orders/:id/status      transitions de statut
 *  /purchasing/purchase-orders/:id/receive     réception (stock_lots + stock_moves + stock_levels)
 */
const { Router } = require('express');
const ctrl = require('./purchasing.controller');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

const ANY_VIEW = perm.permAny(['suppliers.view', 'purchase_orders.view']);
const PRICE_WRITE = perm.permAny(['suppliers.create', 'suppliers.update']);

// Référentiels
router.get('/lookups', ANY_VIEW, ctrl.lookups.bind(ctrl));
router.get('/lookups/skus', perm.permAny(['suppliers.view', 'purchase_orders.view', 'skus.view']), ctrl.searchSkus.bind(ctrl));

// Fournisseurs
router.get('/suppliers', perm.permAny(['suppliers.view', 'purchase_orders.view']), ctrl.suppliersIndex.bind(ctrl));
router.post('/suppliers', perm('suppliers.create'), ctrl.suppliersStore.bind(ctrl));
router.get('/suppliers/:id', perm('suppliers.view'), ctrl.suppliersShow.bind(ctrl));
router.put('/suppliers/:id', perm('suppliers.update'), ctrl.suppliersUpdate.bind(ctrl));
router.patch('/suppliers/:id/toggle-status', perm('suppliers.update'), ctrl.suppliersToggle.bind(ctrl));
router.patch('/suppliers/:id/restore', perm('suppliers.delete'), ctrl.suppliersRestore.bind(ctrl));
router.delete('/suppliers/:id', perm('suppliers.delete'), ctrl.suppliersDestroy.bind(ctrl));

// Prix fournisseurs (lecture ouverte aussi aux acheteurs BC et à la fiche SKU)
const PRICE_VIEW = perm.permAny(['suppliers.view', 'purchase_orders.view', 'skus.view']);
router.get('/supplier-prices', PRICE_VIEW, ctrl.pricesIndex.bind(ctrl));
router.get('/supplier-prices/best', PRICE_VIEW, ctrl.pricesBest.bind(ctrl));
router.get('/supplier-prices/:id', PRICE_VIEW, ctrl.pricesShow.bind(ctrl));
router.post('/supplier-prices', PRICE_WRITE, ctrl.pricesStore.bind(ctrl));
router.post('/supplier-prices/:id/renegotiate', perm('suppliers.update'), ctrl.pricesRenegotiate.bind(ctrl));
router.put('/supplier-prices/:id', perm('suppliers.update'), ctrl.pricesUpdate.bind(ctrl));
router.delete('/supplier-prices/:id', perm.permAny(['suppliers.update', 'suppliers.delete']), ctrl.pricesDestroy.bind(ctrl));

// Bons de commande
router.get('/purchase-orders', perm('purchase_orders.view'), ctrl.ordersIndex.bind(ctrl));
router.post('/purchase-orders', perm('purchase_orders.create'), ctrl.ordersStore.bind(ctrl));
router.get('/purchase-orders/:id', perm('purchase_orders.view'), ctrl.ordersShow.bind(ctrl));
router.put('/purchase-orders/:id', perm('purchase_orders.update'), ctrl.ordersUpdate.bind(ctrl));
router.post('/purchase-orders/:id/status', perm('purchase_orders.update'), ctrl.ordersStatus.bind(ctrl));
router.post('/purchase-orders/:id/cancel', perm('purchase_orders.update'), ctrl.ordersCancel.bind(ctrl));
router.post('/purchase-orders/:id/receive', perm('purchase_orders.receive'), ctrl.ordersReceive.bind(ctrl));
router.delete('/purchase-orders/:id', perm('purchase_orders.update'), ctrl.ordersDestroy.bind(ctrl));

module.exports = router;
