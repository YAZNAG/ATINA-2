const permissionService = require('../services/permission.service');
const response = require('../utils/response');

class PermissionController {
  async matrix(req, res, next) {
    try {
      return response.success(res, await permissionService.getMatrix(), 'Matrice des permissions');
    } catch (err) {
      next(err);
    }
  }

  async getAll(req, res, next) {
    try {
      const permissions = await permissionService.getAll();
      return response.success(res, permissions, 'Permissions retrieved');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PermissionController();
