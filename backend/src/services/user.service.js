const userRepository = require('../repositories/user.repository');
const { hash } = require('../utils/password');

class UserService {
  async getAll() {
    const users = await userRepository.findAll();
    return users.map(({ password_hash, ...u }) => u);
  }

  async getById(id) {
    const user = await userRepository.findById(Number(id));
    if (!user) throw { statusCode: 404, message: 'User not found' };
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  async create({ full_name, email, password, phone, status = 'active', role_ids = [] }) {
    const existing = await userRepository.findByEmail(email);
    if (existing) throw { statusCode: 409, message: 'Email already in use' };

    const password_hash = await hash(password);
    const user = await userRepository.create({ full_name, email, password_hash, phone, status });

    for (const roleId of role_ids) {
      await userRepository.assignRole(user.id, Number(roleId));
    }

    const { password_hash: _, ...safeUser } = await userRepository.findById(user.id);
    return safeUser;
  }

  async update(id, { full_name, email, password, phone, status, role_ids }) {
    const userId = Number(id);
    const existing = await userRepository.findById(userId);
    if (!existing) throw { statusCode: 404, message: 'User not found' };

    const data = {};
    if (full_name !== undefined) data.full_name = full_name;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;
    if (status !== undefined) data.status = status;
    if (password) data.password_hash = await hash(password);

    await userRepository.update(userId, data);

    if (role_ids !== undefined) {
      await userRepository.removeAllRoles(userId);
      for (const roleId of role_ids) {
        await userRepository.assignRole(userId, Number(roleId));
      }
    }

    const { password_hash, ...safeUser } = await userRepository.findById(userId);
    return safeUser;
  }

  async delete(id) {
    const user = await userRepository.findById(Number(id));
    if (!user) throw { statusCode: 404, message: 'User not found' };
    await userRepository.remove(Number(id));
  }
}

module.exports = new UserService();
