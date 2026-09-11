const userService = require('../services/user.service');
const response = require('../utils/response');

class UserController {
  /** GET /users — filtres : search, role_id, status (active|inactive|deleted), page, limit. */
  async getAll(req, res, next) {
    try {
      const { data, pagination } = await userService.getAll(req.query);
      return res.json({ success: true, message: 'Comptes récupérés', data, pagination });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      return response.success(res, await userService.getById(req.params.id), 'Compte récupéré');
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      return response.success(res, await userService.create(req.body, req), 'Compte créé', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      return response.success(res, await userService.update(req.params.id, req.body, req), 'Compte mis à jour');
    } catch (err) {
      next(err);
    }
  }

  async assignRole(req, res, next) {
    try {
      return response.success(res, await userService.assignRole(req.params.id, req.body, req), 'Rôle assigné');
    } catch (err) {
      next(err);
    }
  }

  async activate(req, res, next) {
    try {
      return response.success(res, await userService.setActive(req.params.id, true, req), 'Compte activé');
    } catch (err) {
      next(err);
    }
  }

  async deactivate(req, res, next) {
    try {
      return response.success(res, await userService.setActive(req.params.id, false, req), 'Compte désactivé');
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      await userService.delete(req.params.id, req);
      return response.success(res, null, 'Compte supprimé');
    } catch (err) {
      next(err);
    }
  }

  async restore(req, res, next) {
    try {
      return response.success(res, await userService.restore(req.params.id, req), 'Compte restauré');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new UserController();
