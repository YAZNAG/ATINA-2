const svc  = require('./wallet.service');
const resp = require('../../utils/response');
const E = (res, next, e) => e.statusCode ? resp.error(res, e.message, e.statusCode) : next(e);

class WalletController {
  async txnTypes(req, res, next) {
    try { resp.success(res, await svc.getTxnTypes()); } catch(e) { E(res, next, e); }
  }

  async listTransactions(req, res, next) {
    try { resp.success(res, await svc.listTransactions(req.query)); } catch(e) { E(res, next, e); }
  }

  async getCustomer(req, res, next) {
    try { resp.success(res, await svc.getCustomerWallet(req.params.customerId)); } catch(e) { E(res, next, e); }
  }

  async credit(req, res, next) {
    try {
      const { customer_id, amount, txn_type_code, note, reference } = req.body;
      resp.success(res, await svc.creditWallet({ customer_id, amount: Number(amount), txn_type_code, note, reference }));
    } catch(e) { E(res, next, e); }
  }

  async debit(req, res, next) {
    try {
      const { customer_id, amount, order_id, note, reference } = req.body;
      resp.success(res, await svc.debitWallet({ customer_id, amount: Number(amount), order_id, note, reference }));
    } catch(e) { E(res, next, e); }
  }

  async refund(req, res, next) {
    try {
      const { customer_id, amount, order_id, note } = req.body;
      resp.success(res, await svc.refundWallet({ customer_id, amount: Number(amount), order_id, note }));
    } catch(e) { E(res, next, e); }
  }
}

module.exports = new WalletController();
