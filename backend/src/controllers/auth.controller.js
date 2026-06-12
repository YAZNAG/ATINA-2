const authService = require('../services/auth.service');
const response = require('../utils/response');
const userRepository   = require('../repositories/user.repository');

class AuthController {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const data = await authService.login(email, password);
      return response.success(res, data, 'Login successful');
    } catch (err) {
      next(err);
    }
  }


  async me(req, res, next) {
    try {
      const data = await authService.getProfile(req.user.id);
      return response.success(res, data, 'Profile retrieved');
    } catch (err) {
      next(err);
    }
  }

  logout(req, res) {
    return response.success(res, null, 'Logged out successfully');
  }

  
}

module.exports = new AuthController();
