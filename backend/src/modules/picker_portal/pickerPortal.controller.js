const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { secret, expiresIn } = require('../../config/jwt');
const prisma  = require('../../config/database');
const service  = require('./pickerPortal.service');
const { success, error } = require('../../utils/response');

class PickerPortalController {

  // POST /api/picker/login  — PUBLIQUE
  async login(req, res) {
    try {
      const { phone_country = '+212', phone_number, password } = req.body;
      if (!phone_number || !password)
        return error(res, 'phone_number et password requis', 400);

      const phone = phone_number.replace(/^0/, '');
      const picker = await prisma.picker.findFirst({
        where: { phone_country, phone_number: phone, is_deleted: false },
      });
      if (!picker)          return error(res, 'Identifiants invalides', 401);
      if (!picker.is_active) return error(res, 'Compte inactif', 403);

      const valid = await bcrypt.compare(password, picker.password_hash);
      if (!valid) return error(res, 'Identifiants invalides', 401);

      const token = jwt.sign(
        { id: picker.id, profile_type: 'picker', role: 'picker', node_id: picker.node_id },
        secret,
        { expiresIn }
      );

      const { password_hash: _, ...safe } = picker;
      return success(res, { token, picker: { ...safe, profile_type: 'picker', role: 'picker' } });
    } catch (err) {
      return error(res, err.message ?? 'Erreur serveur', 500);
    }
  }

  // GET /api/picker/available-orders
  async availableOrders(req, res, next) {
    try {
      const data = await service.getAvailableOrders(req.picker);
      return success(res, data, 'Commandes disponibles');
    } catch (err) {
      next(err);
    }
  }

  // GET /api/picker/my-orders
  async myOrders(req, res, next) {
    try {
      const data = await service.getMyOrders(req.picker);
      return success(res, data, 'Mes préparations');
    } catch (err) {
      next(err);
    }
  }

  // POST /api/picker/orders/:orderId/accept
  async acceptOrder(req, res, next) {
    try {
      const { orderId } = req.params;
      const session = await service.acceptOrder(orderId, req.picker);
      return success(res, session, 'Commande acceptée — session picking créée', 201);
    } catch (err) {
      next(err);
    }
  }

  // GET /api/picker/sessions/:sessionId
  async getSession(req, res, next) {
    try {
      const session = await service.getSession(req.params.sessionId);
      if (session.picker_id !== req.picker.id)
        return error(res, 'Cette session ne vous appartient pas', 403);
      return success(res, session);
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/picker/sessions/:sessionId/start
  async startSession(req, res, next) {
    try {
      const session = await service.startSession(req.params.sessionId, req.picker);
      return success(res, session, 'Session démarrée');
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/picker/items/:itemId/pick
  async pickItem(req, res, next) {
    try {
      const { qty_picked, scanned_ean } = req.body;
      const session = await service.pickItem(req.params.itemId, { qty_picked, scanned_ean }, req.picker);
      return success(res, session, 'Article prélevé');
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/picker/items/:itemId/out-of-stock
  async outOfStock(req, res, next) {
    try {
      const session = await service.outOfStock(req.params.itemId, req.picker);
      return success(res, session, 'Article déclaré en rupture');
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/picker/items/:itemId/substitute
  async substituteItem(req, res, next) {
    try {
      const { substitute_sku_id, qty_picked } = req.body;
      const session = await service.substituteItem(req.params.itemId, { substitute_sku_id, qty_picked }, req.picker);
      return success(res, session, 'Article substitué');
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/picker/sessions/:sessionId/complete
  async completeSession(req, res, next) {
    try {
      const session = await service.completeSession(req.params.sessionId, req.picker);
      return success(res, session, 'Préparation terminée — commande prête');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PickerPortalController();
