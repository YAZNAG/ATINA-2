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

  async addPack(req, res, next) {
    try {
      const { pack_id } = req.body;
      const quantity    = parseInt(req.body.quantity) || 1;

      if (!pack_id)    return res.status(400).json({ success: false, message: 'pack_id requis' });
      if (quantity < 1) return res.status(400).json({ success: false, message: 'Quantité invalide' });

      const result = await cartService.addPack(req.customerId, pack_id, quantity);
      resp.success(res, result, 'Pack ajouté au panier');
    } catch (err) { next(err); }
  }

  async updatePackQuantity(req, res, next) {
    try {
      const { pack_id } = req.params;
      const quantity     = parseInt(req.body.quantity);

      if (!Number.isFinite(quantity)) {
        return res.status(400).json({ success: false, message: 'Quantité invalide' });
      }

      const result = await cartService.updatePackQuantity(req.customerId, pack_id, quantity);
      resp.success(res, result, 'Pack mis à jour');
    } catch (err) { next(err); }
  }

  async removePack(req, res, next) {
    try {
      const { pack_id } = req.params;
      const result = await cartService.removePack(req.customerId, pack_id);
      resp.success(res, result, 'Pack supprimé');
    } catch (err) { next(err); }
  }

  async updateItem(req, res, next) {
    try {
      const { item_id } = req.params;
      const quantity     = parseInt(req.body.quantity);

      if (!quantity || quantity < 1) {
        return res.status(400).json({ success: false, message: 'Quantité invalide' });
      }

      const result = await cartService.updateItem(req.customerId, item_id, quantity);
      resp.success(res, result, 'Quantité mise à jour');
    } catch (err) { next(err); }
  }

  async removeItem(req, res, next) {
    try {
      const { item_id } = req.params;
      const result = await cartService.removeItem(req.customerId, item_id);
      resp.success(res, result, 'Article supprimé');
    } catch (err) { next(err); }
  }

  async clearCart(req, res, next) {
    try {
      const result = await cartService.clearCart(req.customerId);
      resp.success(res, result, 'Panier vidé');
    } catch (err) { next(err); }
  }

  async reorder(req, res, next) {
  try {
    const { order_id, mode } = req.body;
    resp.success(res, await cartService.reorderFromOrder(req.customerId, order_id, mode), 'Panier mis à jour');
  } catch (err) { next(err); }
}
}

module.exports = new CustomerCartController();
