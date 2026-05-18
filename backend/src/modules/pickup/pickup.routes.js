const { Router } = require('express');
const svc  = require('./pickup.service');
const resp = require('../../utils/response');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

const canView   = perm.permAny(['orders.view',          'dashboard.view']);
const canManage = perm.permAny(['orders.update_status',  'dashboard.view']);

const E = (res, next, e) => e.statusCode ? resp.error(res, e.message, e.statusCode) : next(e);

// ── List ready pickup orders ──────────────────────────────────────────────────
router.get('/ready-orders', canView, async (req, res, next) => {
  try {
    const { node_id, search } = req.query;
    resp.success(res, await svc.listReadyOrders({ node_id, search }));
  } catch(e) { E(res, next, e); }
});

// ── Order detail ──────────────────────────────────────────────────────────────
router.get('/orders/:orderId', canView, async (req, res, next) => {
  try {
    resp.success(res, await svc.getOrderDetail(req.params.orderId));
  } catch(e) { E(res, next, e); }
});

// ── Collect COD at counter ────────────────────────────────────────────────────
router.patch('/orders/:orderId/collect-cod', canManage, async (req, res, next) => {
  try {
    const { amount_collected, payment_note } = req.body;
    resp.success(res, await svc.collectCOD(req.params.orderId, { amount_collected, payment_note }, req.user?.id ?? null));
  } catch(e) { E(res, next, e); }
});

// ── Confirm pickup → delivered ────────────────────────────────────────────────
router.patch('/orders/:orderId/confirm', canManage, async (req, res, next) => {
  try {
    const { note } = req.body ?? {};
    resp.success(res, await svc.confirmPickup(req.params.orderId, { note }, req.user?.id ?? null), 'Retrait confirmé — commande livrée');
  } catch(e) { E(res, next, e); }
});

// ── Cancel ready order ────────────────────────────────────────────────────────
router.patch('/orders/:orderId/cancel', canManage, async (req, res, next) => {
  try {
    const { reason } = req.body ?? {};
    resp.success(res, await svc.cancelReadyOrder(req.params.orderId, { reason }, req.user?.id ?? null), 'Commande annulée — stock libéré');
  } catch(e) { E(res, next, e); }
});

module.exports = router;
