const svc  = require('./checkout.service');
const repo = require('./checkout.repository');
const resp = require('../../utils/response');

class CheckoutController {

  // POST /api/checkout/eligible-nodes
  async eligibleNodes(req, res, next) {
    try {
      const { address_id, cart_items = [], date } = req.body;
      if (!address_id) return resp.error(res, 'address_id requis', 400);
      const result = await svc.findEligibleNodes(address_id, cart_items, date);
      resp.success(res, result);
    } catch (e) {
      if (e.statusCode) return resp.error(res, e.message, e.statusCode);
      next(e);
    }
  }

  // GET /api/checkout/delivery-slots
  async deliverySlots(req, res, next) {
    try {
      const { address_id, delivery_type_id, date } = req.query;
      let cart_items = [];
      if (req.query.cart_items) {
        try { cart_items = JSON.parse(req.query.cart_items); } catch { cart_items = []; }
      }
      if (!delivery_type_id) return resp.error(res, 'delivery_type_id requis', 400);
      const result = await svc.getDeliverySlots(address_id, delivery_type_id, cart_items, date);
      resp.success(res, result);
    } catch (e) {
      if (e.statusCode) return resp.error(res, e.message, e.statusCode);
      next(e);
    }
  }

  // POST /api/checkout/create-order
  async createOrder(req, res, next) {
    try {
      const order = await svc.createOrder(req.body);
      resp.success(res, order, 'Commande créée', 201);
    } catch (e) {
      if (e.statusCode) return resp.error(res, e.message, e.statusCode, e.issues);
      next(e);
    }
  }

  // GET /api/checkout/meta — delivery types + payment methods
  async meta(req, res, next) {
    try {
      const [deliveryTypes, paymentMethods] = await Promise.all([
        repo.getAllDeliveryTypes(),
        repo.getAllPaymentMethods(),
      ]);
      resp.success(res, { delivery_types: deliveryTypes, payment_methods: paymentMethods });
    } catch (e) { next(e); }
  }

  // GET /api/checkout/articles?search=xxx&limit=20
  async articles(req, res, next) {
    try {
      const { search, limit = 20 } = req.query;
      const data = await repo.searchArticles(search, limit);
      resp.success(res, data);
    } catch (e) { next(e); }
  }
}

module.exports = new CheckoutController();
