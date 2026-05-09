const repo = require('./stock_lot.repository');

const _validate = (body) => {
  const { sku_id, node_id, qty_initial, cost_unit } = body;
  if (!sku_id)               throw { statusCode: 400, message: 'sku_id requis' };
  if (!node_id)              throw { statusCode: 400, message: 'node_id requis' };
  if (!(qty_initial > 0))    throw { statusCode: 400, message: 'qty_initial doit être > 0' };
  if (cost_unit === undefined || cost_unit === null || cost_unit < 0)
                             throw { statusCode: 400, message: 'cost_unit requis (≥ 0)' };
};

const getWithFilters = (params)  => repo.findWithFilters(params);
const getById        = (id)      => repo.findById(id);
const getAlerts      = (node_id) => repo.getAlerts(node_id);

const create = (body) => {
  _validate(body);
  const { sku_id, node_id, qty_initial, cost_unit, lot_number, expiry_date } = body;
  return repo.createLot({
    sku_id,
    node_id,
    qty_initial:   Number(qty_initial),
    qty_remaining: Number(qty_initial),
    cost_unit:     Number(cost_unit),
    lot_number:    lot_number ?? null,
    expiry_date:   expiry_date ? new Date(expiry_date) : null,
  });
};

const remove = (id) => repo.softDelete(id);

module.exports = { getWithFilters, getById, getAlerts, create, remove };
