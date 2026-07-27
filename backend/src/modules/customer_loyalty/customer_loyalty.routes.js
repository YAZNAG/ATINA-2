const { Router } = require('express');
const svc  = require('./customer_loyalty.service');
const resp = require('../../utils/response');
const customerAuth = require('../../middlewares/customer_auth.middleware');

const router = Router();
const E = (res, next, e) => e.statusCode ? resp.error(res, e.message, e.statusCode) : next(e);

router.get('/summary', customerAuth, async (req, res, next) => {
  try {
    const data = await svc.getSummary(req.customerId);
    resp.success(res, data);
  } catch (e) { E(res, next, e); }
});

router.get('/history', customerAuth, async (req, res, next) => {
  try {
    const limit  = Math.min(50, Number(req.query.limit) || 20);
    const cursor = req.query.cursor || null;
    const data   = await svc.getHistory(req.customerId, limit, cursor);
    resp.success(res, data);
  } catch (e) { E(res, next, e); }
});

router.post('/redeem', customerAuth, async (req, res, next) => {
  try {
    const data = await svc.redeem(req.customerId);
    resp.success(res, data);
  } catch (e) { E(res, next, e); }
});

module.exports = router;