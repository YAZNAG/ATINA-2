const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const userRepository = require('../repositories/user.repository');
const { compare } = require('../utils/password');
const prisma = require('../config/database');
const { hash } = require('../utils/password');

class AuthService {
  async login(email, password) {
    const user = await userRepository.findByEmail(email);
    if (!user) throw { statusCode: 401, message: 'Identifiants invalides' };
    if (user.is_deleted)          throw { statusCode: 403, message: 'Compte supprimé' };
    if (!user.is_active || user.status !== 'active') throw { statusCode: 403, message: 'Compte inactif' };

    const isValid = await compare(password, user.password_hash);
    if (!isValid) throw { statusCode: 401, message: 'Identifiants invalides' };

    const permissions = this._extractPermissions(user);
    const token = this._generateToken(user);

    userRepository.updateLastLogin(user.id).catch(() => {});

    return { token, user: this._sanitizeUser(user, permissions) };
  }

  
  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw { statusCode: 404, message: 'User not found' };
    const permissions = this._extractPermissions(user);
    return this._sanitizeUser(user, permissions);
  }

  _generateToken(user) {
    return jwt.sign(
      { userId: user.id, email: user.email },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );
  }

  

  _extractPermissions(user) {
    const permissions = new Set();
    user.user_roles?.forEach((ur) => {
      ur.role?.role_permissions?.forEach((rp) => {
        permissions.add(rp.permission.code);
      });
    });
    return [...permissions];
  }

  _sanitizeUser(user, permissions) {
    const { password_hash, ...safeUser } = user;
    const roles = user.user_roles?.map((ur) => ur.role) || [];
    return { ...safeUser, roles, permissions };
  }



async checkEmail(email) {
  const existing = await userRepository.findByEmail(email);
  return !existing; 
}

}





module.exports = new AuthService();
