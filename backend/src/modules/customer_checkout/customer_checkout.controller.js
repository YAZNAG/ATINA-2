const svc  = require('./customer_checkout.service');
const resp = require('../../utils/response');

class CustomerCheckoutController {
  async meta(req, res, next) {
    try {
      const node_id = req.query.node_id || null;
      return resp.success(res, await svc.getMeta(node_id));
    } catch (e) { next(e); }
  }

  async eligibleNodes(req, res, next) {
    try {
      const { address_id, cart_items, date } = req.body;
      if (!address_id) return resp.error(res, 'address_id requis', 400);
      const result = await svc.findEligibleNodes(address_id, cart_items || [], date);
      return resp.success(res, result);
    } catch (e) { next(e); }
  }

  async pickupNodes(req, res, next) {
    try {
      const cart_items = req.query.cart_items
        ? JSON.parse(req.query.cart_items)
        : req.body?.cart_items || [];
      const date = req.query.date || req.body?.date;
      const result = await svc.findPickupNodes(req.customerId, cart_items, date);
      return resp.success(res, result);
    } catch (e) { next(e); }
  }

  async deliverySlots(req, res, next) {
    try {
      const params = {
        address_id:         req.query.address_id,
        node_id:            req.query.node_id,
        delivery_type_id:   req.query.delivery_type_id,
        delivery_type_code: req.query.delivery_type_code,
        date:               req.query.date,
        cart_items:         req.query.cart_items
          ? JSON.parse(req.query.cart_items)
          : [],
      };
      const result = await svc.getDeliverySlots(params);
      return resp.success(res, result);
    } catch (e) { next(e); }
  }

async calculate(req, res, next) {
  try { resp.success(res, await svc.calculate(req.customerId, req.body)); }
  catch(e) { next(e); }
}

  async createOrder(req, res, next) {
    try {
      const customerId = req.customerId;
      const order = await svc.createOrder(customerId, req.body);
      return resp.success(res, { id: order.id, reference: order.id, status: order.status?.code }, 'Commande créée', 201);
    } catch (e) { next(e); }
  }
}


module.exports = new CustomerCheckoutController();
