/**
 * Cached status/type helpers — look up IDs by code, cache in-process memory.
 * Never hardcode IDs. Always use these helpers.
 */
const prisma = require('../config/database');

const _cache = {};

async function _lookup(model, code, prefix) {
  const key = `${prefix}:${code}`;
  if (!_cache[key]) {
    _cache[key] = await prisma[model].findFirst({ where: { code } }) ?? null;
  }
  return _cache[key];
}

function _mustExist(row, label) {
  if (!row) throw { statusCode: 500, message: `"${label}" introuvable en base — relancez le seed` };
  return row;
}

// ── Order statuses ─────────────────────────────────────────────────────────────
const getOrderStatus   = (code) => _lookup('orderStatus',     code, 'os');
const getOrderStatusId = async (code) => _mustExist(await getOrderStatus(code), `order_status:${code}`).id;

// ── Order item statuses ────────────────────────────────────────────────────────
const getOrderItemStatus   = (code) => _lookup('orderItemStatus', code, 'ois');
const getOrderItemStatusId = async (code) => _mustExist(await getOrderItemStatus(code), `order_item_status:${code}`).id;

// ── Payment statuses ───────────────────────────────────────────────────────────
const getPaymentStatus   = (code) => _lookup('paymentStatus',   code, 'ps');
const getPaymentStatusId = async (code) => _mustExist(await getPaymentStatus(code), `payment_status:${code}`).id;

// ── Picking statuses ───────────────────────────────────────────────────────────
const getPickingStatus   = (code) => _lookup('pickingStatus',   code, 'pks');
const getPickingStatusId = async (code) => _mustExist(await getPickingStatus(code), `picking_status:${code}`).id;

// ── Pick item statuses ─────────────────────────────────────────────────────────
const getPickItemStatus   = (code) => _lookup('pickItemStatus', code, 'pis');
const getPickItemStatusId = async (code) => _mustExist(await getPickItemStatus(code), `pick_item_status:${code}`).id;

// ── Delivery types ─────────────────────────────────────────────────────────────
const getDeliveryType   = (code) => _lookup('deliveryType',    code, 'dt');
const getDeliveryTypeId = async (code) => _mustExist(await getDeliveryType(code), `delivery_type:${code}`).id;

// ── Payment methods ────────────────────────────────────────────────────────────
const getPaymentMethod   = (code) => _lookup('paymentMethod',  code, 'pm');
const getPaymentMethodId = async (code) => _mustExist(await getPaymentMethod(code), `payment_method:${code}`).id;

// ── Tour statuses ──────────────────────────────────────────────────────────────
const getTourStatus   = (code) => _lookup('tourStatus',        code, 'ts');
const getTourStatusId = async (code) => _mustExist(await getTourStatus(code), `tour_status:${code}`).id;

// ── Stop statuses ──────────────────────────────────────────────────────────────
const getStopStatus   = (code) => _lookup('stopStatus',        code, 'ss');
const getStopStatusId = async (code) => _mustExist(await getStopStatus(code), `stop_status:${code}`).id;

// ── Wallet txn types ───────────────────────────────────────────────────────────
const getWalletTxnType   = (code) => _lookup('walletTxnType',  code, 'wtt');
const getWalletTxnTypeId = async (code) => _mustExist(await getWalletTxnType(code), `wallet_txn_type:${code}`).id;

// ── Move types ─────────────────────────────────────────────────────────────────
const getMoveType   = (code) => _lookup('moveType',            code, 'mvt');
const getMoveTypeId = async (code) => (await getMoveType(code))?.id ?? null; // optional

// ── Cache invalidation (after seed) ───────────────────────────────────────────
const clearCache = () => { Object.keys(_cache).forEach(k => delete _cache[k]); };

module.exports = {
  getOrderStatus,    getOrderStatusId,
  getOrderItemStatus,getOrderItemStatusId,
  getPaymentStatus,  getPaymentStatusId,
  getPickingStatus,  getPickingStatusId,
  getPickItemStatus, getPickItemStatusId,
  getDeliveryType,   getDeliveryTypeId,
  getPaymentMethod,  getPaymentMethodId,
  getTourStatus,     getTourStatusId,
  getStopStatus,     getStopStatusId,
  getWalletTxnType,  getWalletTxnTypeId,
  getMoveType,       getMoveTypeId,
  clearCache,
};
