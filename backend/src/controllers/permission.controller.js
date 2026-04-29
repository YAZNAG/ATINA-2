const permissionService = require('../services/permission.service');
const response = require('../utils/response');

class PermissionController {
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
