const svc  = require('./checkout.service');
const repo = require('./checkout.repository');
const resp = require('../../utils/response');
const { PICKUP_LIKE_CODES } = svc;

class CheckoutController {

  // GET /api/checkout/meta?node_id=...
  async meta(req, res, next) {
    try {
      const { node_id } = req.query;
      const data = await svc.getMeta(node_id || null);
      resp.success(res, data);
    } catch (e) { next(e); }
  }

  // GET /api/checkout/available-dates?node_id=...&delivery_type_code=home&days_ahead=14
  async availableDates(req, res, next) {
    try {
      const { node_id, delivery_type_code = 'home', days_ahead = 14 } = req.query;
      if (!node_id) return resp.error(res, 'node_id requis', 400);
      const data = await svc.getAvailableDates(node_id, delivery_type_code, Number(days_ahead));
      resp.success(res, data);
    } catch (e) {
      if (e.statusCode) return resp.error(res, e.message, e.statusCode);
      next(e);
    }
  }

  // GET /api/checkout/articles?search=xxx&limit=20
  async articles(req, res, next) {
    try {
      const { search, limit = 20 } = req.query;
      const data = await repo.searchArticles(search, limit);
      resp.success(res, data);
    } catch (e) { next(e); }
  }

  // GET /api/checkout/customers?search=xxx
  async customers(req, res, next) {
    try {
      const { search, limit = 30 } = req.query;
      const data = await repo.searchCustomers(search, limit);
      resp.success(res, data);
    } catch (e) { next(e); }
  }

  // GET /api/checkout/customers/:customerId/addresses
  async customerAddresses(req, res, next) {
    try {
      const { customerId } = req.params;
      const data = await repo.getCustomerAddresses(customerId);
      resp.success(res, data);
    } catch (e) { next(e); }
  }

  // POST /api/checkout/eligible-nodes
  async eligibleNodes(req, res, next) {
    try {
      const { address_id, cart_items = [], date, delivery_type_code } = req.body;

      if (PICKUP_LIKE_CODES.includes(delivery_type_code)) {
        const result = await svc.findPickupNodes(cart_items, date);
        return resp.success(res, result);
      }

      if (!address_id) return resp.error(res, 'address_id requis pour livraison à domicile', 400);
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
      const { address_id, node_id, delivery_type_id, delivery_type_code, date } = req.query;
      let cart_items = [];
      if (req.query.cart_items) {
        try { cart_items = JSON.parse(req.query.cart_items); } catch { cart_items = []; }
      }
      if (!delivery_type_id && !delivery_type_code)
        return resp.error(res, 'delivery_type_id ou delivery_type_code requis', 400);

      const result = await svc.getDeliverySlots({ address_id, node_id, delivery_type_id, delivery_type_code, cart_items, date });
      resp.success(res, result);
    } catch (e) {
      if (e.statusCode) return resp.error(res, e.message, e.statusCode);
      next(e);
    }
  }

  // POST /api/checkout/calculate
  async calculate(req, res, next) {
    try {
      const result = await svc.calculate(req.body);
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
}

module.exports = new CheckoutController();
