const repo = require('./stock_operation.repository');

module.exports = {
  getAll: () => repo.getAll(),
  seed:   () => repo.seed(),
};
