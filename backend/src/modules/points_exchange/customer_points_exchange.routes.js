/**
 * Routes CLIENT (app mobile) — catalogue « Échanger mes points » (WF #19 partie A).
 * À monter AVANT les montages génériques :
 *   router.use('/customer/points-exchange', require('../modules/points_exchange/customer_points_exchange.routes'));
 */
const { Router } = require('express');
const customerAuth = require('../../middlewares/customer_auth.middleware');
const resp = require('../../utils/response');
const svc = require('./points_exchange.customer');

const router = Router();
router.use(customerAuth);

// GET /customer/points-exchange?node_id=  → { node, points_balance, items[] }
router.get('/', async (req, res, next) => {
  try {
    const nodeId = req.query.node_id || req.headers['x-node-id'] || null;
    return resp.success(res, await svc.customerCatalog(req.customerId, { node_id: nodeId }));
  } catch (e) { next(e); }
});

module.exports = router;
