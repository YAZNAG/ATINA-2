const repo = require('./stock_move.repository');

const getWithFilters = (params) => repo.findWithFilters(params);
const getById        = (id)     => repo.findById(id);
const getStats       = (node_id) => repo.getStats(node_id);

module.exports = { getWithFilters, getById, getStats };
