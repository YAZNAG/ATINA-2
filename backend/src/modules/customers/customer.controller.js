const service = require('./customer.service');
const response = require('../../utils/response');

const MISSING_TABLE_HINT =
  'La table « customers » est absente ou le client Prisma est obsolète. Exécutez les migrations / `npx prisma generate` dans backend.';

function handleTableError(err, res, next) {
  if (err?.code === 'P2021') return response.error(res, MISSING_TABLE_HINT, 503);
  if (typeof err?.message === 'string' && err.message.includes('does not exist in the current database')) {
    return response.error(res, MISSING_TABLE_HINT, 503);
  }
  return next(err);
}

class CustomerController {
  async index(req, res, next) {
    try {
      const data = await service.list(req.query);
      return response.success(res, data);
    } catch (err) {
      return handleTableError(err, res, next);
    }
  }

  async show(req, res, next) {
    try {
      const data = await service.getById(req.params.id);
      return response.success(res, data);
    } catch (err) {
      if (err.statusCode === 404) return response.error(res, err.message, 404);
      return handleTableError(err, res, next);
    }
  }

  async store(req, res, next) {
    try {
      const data = await service.create(req.body);
      return response.success(res, data, 'Client créé', 201);
    } catch (err) {
      if (err.statusCode) return response.error(res, err.message, err.statusCode);
      return handleTableError(err, res, next);
    }
  }

  async update(req, res, next) {
    try {
      const data = await service.update(req.params.id, req.body);
      return response.success(res, data, 'Client mis à jour');
    } catch (err) {
      if (err.statusCode) return response.error(res, err.message, err.statusCode);
      return handleTableError(err, res, next);
    }
  }

  async block(req, res, next) {
    try {
      const data = await service.block(req.params.id);
      return response.success(res, data, 'Client bloqué');
    } catch (err) {
      if (err.statusCode) return response.error(res, err.message, err.statusCode);
      return handleTableError(err, res, next);
    }
  }

  async unblock(req, res, next) {
    try {
      const data = await service.unblock(req.params.id);
      return response.success(res, data, 'Client débloqué');
    } catch (err) {
      if (err.statusCode) return response.error(res, err.message, err.statusCode);
      return handleTableError(err, res, next);
    }
  }

  async destroy(req, res, next) {
    try {
      await service.softDelete(req.params.id);
      return response.success(res, null, 'Client supprimé (logique)');
    } catch (err) {
      if (err.statusCode) return response.error(res, err.message, err.statusCode);
      return handleTableError(err, res, next);
    }
  }
}

module.exports = new CustomerController();
