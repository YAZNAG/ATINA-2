const roleService = require('../services/role.service');
const response = require('../utils/response');

class RoleController {
  async getAll(req, res, next) {
    try {
      const roles = await roleService.getAll();
      return response.success(res, roles, 'Roles retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const role = await roleService.getById(req.params.id);
      return response.success(res, role, 'Role retrieved');
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const role = await roleService.create(req.body);
      return response.success(res, role, 'Role created', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const role = await roleService.update(req.params.id, req.body);
      return response.success(res, role, 'Role updated');
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      await roleService.delete(req.params.id);
      return response.success(res, null, 'Role deleted');
    } catch (err) {
      next(err);
    }
  }

  async assignPermissions(req, res, next) {
    try {
      const role = await roleService.assignPermissions(
        req.params.id,
        req.body.permission_ids || []
      );
      return response.success(res, role, 'Permissions assigned');
    } catch (err) {
      next(err);
    }
  }

  async getPermissions(req, res, next) {
    try {
      const permissions = await roleService.getRolePermissions(req.params.id);
      return response.success(res, permissions, 'Permissions retrieved');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new RoleController();
