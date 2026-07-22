const svc  = require('./customer_wallet.service');
const resp = require('../../utils/response');
const E = (res, next, e) => e.statusCode ? resp.error(res, e.message, e.statusCode) : next(e);

class CustomerWalletController {

  async getWallet(req, res, next) {
    try {
      resp.success(res, await svc.getMyWallet(req.customerId));
    } catch (e) { E(res, next, e); }
  }
  
  async getTransactions(req, res, next) {
    try {
      const { page, limit } = req.query;
      resp.success(res, await svc.getMyTransactions(req.customerId, { page, limit }));
    } catch (e) { E(res, next, e); }
  }
}

module.exports = new CustomerWalletController();