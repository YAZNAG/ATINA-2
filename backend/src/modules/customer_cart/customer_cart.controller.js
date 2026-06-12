const cartService = require('./customer_cart.service');
const resp        = require('../../utils/response');

class CustomerCartController {

  async getCart(req, res, next) {
    try {
      const result = await cartService.getCart(req.customerId);
      resp.success(res, result);
    } catch (err) { next(err); }
  }

  async addItem(req, res, next) {
    try {
      const { sku_id } = req.body;
      const quantity   = parseInt(req.body.quantity) || 1;

      if (!sku_id)    return res.status(400).json({ success: false, message: 'sku_id requis' });
      if (quantity < 1) return res.status(400).json({ success: false, message: 'Quantité invalide' });

      const result = await cartService.addItem(req.customerId, sku_id, quantity);
      resp.success(res, result, 'Article ajouté au panier');
    } catch (err) { next(err); }
  }

  async updateItem(req, res, next) {
    try {
      const { sku_id } = req.params;
      const quantity   = parseInt(req.body.quantity);

      if (!quantity || quantity < 1) {
        return res.status(400).json({ success: false, message: 'Quantité invalide' });
      }

      const result = await cartService.updateItem(req.customerId, sku_id, quantity);
      resp.success(res, result, 'Quantité mise à jour');
    } catch (err) { next(err); }
  }

  async removeItem(req, res, next) {
    try {
      const { sku_id } = req.params;
      const result = await cartService.removeItem(req.customerId, sku_id);
      resp.success(res, result, 'Article supprimé');
    } catch (err) { next(err); }
  }

  async clearCart(req, res, next) {
    try {
      const result = await cartService.clearCart(req.customerId);
      resp.success(res, result, 'Panier vidé');
    } catch (err) { next(err); }
  }
}

module.exports = new CustomerCartController();