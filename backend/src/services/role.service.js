const roleRepository = require('../repositories/role.repository');

class RoleService {
  async getAll() {
    return roleRepository.findAll();
  }

  async getById(id) {
    const role = await roleRepository.findById(Number(id));
    if (!role) throw { statusCode: 404, message: 'Role not found' };
    return role;
  }

  async create({ name, code, description, status = 'active', permission_ids = [] }) {
    const existing = await roleRepository.findByCode(code);
    if (existing) throw { statusCode: 409, message: 'Role code already in use' };

    const role = await roleRepository.create({ name, code, description, status });

    if (permission_ids.length > 0) {
      return roleRepository.setPermissions(role.id, permission_ids.map(Number));
    }
    return role;
  }

  async update(id, { name, code, description, status, permission_ids }) {
    const roleId = Number(id);
    const existing = await roleRepository.findById(roleId);
    if (!existing) throw { statusCode: 404, message: 'Role not found' };

    const data = {};
    if (name !== undefined) data.name = name;
    if (code !== undefined) data.code = code;
    if (description !== undefined) data.description = description;
    if (status !== undefined) data.status = status;

    await roleRepository.update(roleId, data);

    if (permission_ids !== undefined) {
      return roleRepository.setPermissions(roleId, permission_ids.map(Number));
    }
    return roleRepository.findById(roleId);
  }

  async delete(id) {
    const role = await roleRepository.findById(Number(id));
    if (!role) throw { statusCode: 404, message: 'Role not found' };
    await roleRepository.remove(Number(id));
  }

  async assignPermissions(roleId, permissionIds) {
    const role = await roleRepository.findById(Number(roleId));
    if (!role) throw { statusCode: 404, message: 'Role not found' };
    return roleRepository.setPermissions(Number(roleId), permissionIds.map(Number));
  }

  async getRolePermissions(roleId) {
    const role = await roleRepository.findById(Number(roleId));
    if (!role) throw { statusCode: 404, message: 'Role not found' };
    return role.role_permissions.map((rp) => rp.permission);
  }
}

module.exports = new RoleService();
