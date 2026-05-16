const { Router } = require('express');
const svc  = require('./reporting.service');
const resp = require('../../utils/response');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');

const router = Router();
router.use(auth);
const canView = perm.permAny(['dashboard.view', 'reporting.view']);

const E = (res, next, e) => e.statusCode ? resp.error(res, e.message, e.statusCode) : next(e);

router.get('/dashboard', canView, async (req, res, next) => {
  try { resp.success(res, await svc.dashboardSummary(req.query)); } catch(e) { E(res, next, e); }
});
router.get('/orders',   canView, async (req, res, next) => {
  try { resp.success(res, await svc.orderKpis(req.query)); } catch(e) { E(res, next, e); }
});
router.get('/picking',  canView, async (req, res, next) => {
  try { resp.success(res, await svc.pickingKpis(req.query)); } catch(e) { E(res, next, e); }
});
router.get('/delivery', canView, async (req, res, next) => {
  try { resp.success(res, await svc.deliveryKpis(req.query)); } catch(e) { E(res, next, e); }
});
router.get('/stock',    canView, async (req, res, next) => {
  try { resp.success(res, await svc.stockKpis(req.query)); } catch(e) { E(res, next, e); }
});
router.get('/payments', canView, async (req, res, next) => {
  try { resp.success(res, await svc.paymentKpis(req.query)); } catch(e) { E(res, next, e); }
});

module.exports = router;
