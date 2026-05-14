const { Router } = require('express');
const ctrl  = require('./pickerPortal.controller');
const { requirePickerAuth } = require('../../middlewares/pickerAuth.middleware');
const { validateAcceptOrder, validatePickItem, validateSubstitute } = require('./pickerPortal.validation');

const router = Router();

// ── PUBLIC — aucun token requis ───────────────────────────────────────────────
router.post('/login', ctrl.login);

// ── PROTÉGÉES — token picker obligatoire pour toutes les routes suivantes ─────
router.use(requirePickerAuth);

// Commandes
router.get('/available-orders',               ctrl.availableOrders);
router.get('/my-orders',                      ctrl.myOrders);
router.post('/orders/:orderId/accept',        validateAcceptOrder, ctrl.acceptOrder);

// Sessions
router.get('/sessions/:sessionId',            ctrl.getSession);
router.patch('/sessions/:sessionId/start',    ctrl.startSession);
router.patch('/sessions/:sessionId/complete', ctrl.completeSession);

// Items
router.patch('/items/:itemId/pick',           validatePickItem,   ctrl.pickItem);
router.patch('/items/:itemId/out-of-stock',   ctrl.outOfStock);
router.patch('/items/:itemId/substitute',     validateSubstitute, ctrl.substituteItem);

module.exports = router;
