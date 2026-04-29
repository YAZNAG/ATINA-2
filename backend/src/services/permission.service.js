const permissionRepository = require('../repositories/permission.repository');

class PermissionService {
  async getAll() {
    const permissions = await permissionRepository.findAll();
    return permissions.reduce((acc, p) => {
      if (!acc[p.module]) acc[p.module] = [];
      acc[p.module].push(p);
      return acc;
    }, {});
  }
}

module.exports = new PermissionService();
