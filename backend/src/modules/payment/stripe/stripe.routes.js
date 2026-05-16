const { Router } = require('express');
const svc  = require('./stripe.service');
const resp = require('../../../utils/response');
const auth = require('../../../middlewares/auth.middleware');
const customerAuth = require('../../../middlewares/customer_auth.middleware');

const E = (res, next, e) => e.statusCode ? resp.error(res, e.message, e.statusCode) : next(e);

const router = Router();

// ── Public key (no auth needed) ───────────────────────────────────────────────
router.get('/config', (req, res) => {
  res.json({ public_key: svc.getPublicKey() });
});

// ── Create Payment Intent (customer mobile) ───────────────────────────────────
router.post('/create-intent', customerAuth, async (req, res, next) => {
  try {
    const { order_id } = req.body;
    if (!order_id) return resp.error(res, 'order_id requis', 400);
    resp.success(res, await svc.createPaymentIntent(order_id));
  } catch(e) { E(res, next, e); }
});

// ── Create Checkout Session (web / back-office) ───────────────────────────────
router.post('/create-session', auth, async (req, res, next) => {
  try {
    const { order_id, success_url, cancel_url } = req.body;
    if (!order_id) return resp.error(res, 'order_id requis', 400);
    resp.success(res, await svc.createCheckoutSession(order_id, success_url, cancel_url));
  } catch(e) { E(res, next, e); }
});

// ── Customer-facing create session (for mobile redirect) ──────────────────────
router.post('/create-session-customer', customerAuth, async (req, res, next) => {
  try {
    const { order_id, success_url, cancel_url } = req.body;
    if (!order_id) return resp.error(res, 'order_id requis', 400);
    resp.success(res, await svc.createCheckoutSession(order_id, success_url, cancel_url));
  } catch(e) { E(res, next, e); }
});

// ── Webhook (raw body required) ───────────────────────────────────────────────
// Note: must be registered BEFORE express.json() middleware in server.js
router.post('/webhook',
  (req, res, next) => {
    // Stripe needs raw body for signature verification
    // If server uses express.json() globally, we need the raw buffer here
    next();
  },
  async (req, res, next) => {
    try {
      const sig = req.headers['stripe-signature'];
      const rawBody = req.rawBody ?? (req.body ? Buffer.from(JSON.stringify(req.body)) : Buffer.alloc(0));
      const result = await svc.handleWebhook(rawBody, sig);
      res.json(result);
    } catch(e) { E(res, next, e); }
  }
);

module.exports = router;
