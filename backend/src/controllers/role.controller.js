const roleService = require('../services/role.service');
const response = require('../utils/response');

class RoleController {
  /** GET /roles — filtres : search, status (active|inactive), assignable=true (rôles actifs seulement). */
  async getAll(req, res, next) {
    try {
      return response.success(res, await roleService.getAll(req.query), 'Rôles récupérés');
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      return response.success(res, await roleService.getById(req.params.id), 'Rôle récupéré');
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      return response.success(res, await roleService.create(req.body, req), 'Rôle créé', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      return response.success(res, await roleService.update(req.params.id, req.body, req), 'Rôle mis à jour');
    } catch (err) {
      next(err);
    }
  }

  async activate(req, res, next) {
    try {
      return response.success(res, await roleService.setActive(req.params.id, true, req), 'Rôle activé');
    } catch (err) {
      next(err);
    }
  }

  async deactivate(req, res, next) {
    try {
      return response.success(res, await roleService.setActive(req.params.id, false, req), 'Rôle désactivé');
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      await roleService.delete(req.params.id, req);
      return response.success(res, null, 'Rôle supprimé');
    } catch (err) {
      next(err);
    }
  }

  async assignPermissions(req, res, next) {
    try {
      const role = await roleService.assignPermissions(req.params.id, req.body.permission_ids || [], req);
      return response.success(res, role, 'Permissions enregistrées');
    } catch (err) {
      next(err);
    }
  }

  async getPermissions(req, res, next) {
    try {
      return response.success(res, await roleService.getRolePermissions(req.params.id), 'Permissions récupérées');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new RoleController();
