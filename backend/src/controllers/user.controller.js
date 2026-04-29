const userService = require('../services/user.service');
const response = require('../utils/response');

class UserController {
  async getAll(req, res, next) {
    try {
      const users = await userService.getAll();
      return response.success(res, users, 'Users retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const user = await userService.getById(req.params.id);
      return response.success(res, user, 'User retrieved');
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const user = await userService.create(req.body);
      return response.success(res, user, 'User created', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const user = await userService.update(req.params.id, req.body);
      return response.success(res, user, 'User updated');
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      await userService.delete(req.params.id);
      return response.success(res, null, 'User deleted');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new UserController();
