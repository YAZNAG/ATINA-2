const svc  = require('./customer_auth.service');
const resp = require('../../utils/response');
const E    = (res, next, e) => { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); };

class CustomerAuthController {
  async checkPhone(req, res, next) {
    try {
      const { phone_country = '+212', phone_number } = req.body;
      if (!phone_number) return resp.error(res, 'phone_number requis', 400);
      resp.success(res, await svc.checkPhone(phone_country, phone_number));
    } catch(e) { E(res, next, e); }
  }

  async requestOtp(req, res, next) {
    try {
      const { phone_country = '+212', phone_number } = req.body;
      if (!phone_number) return resp.error(res, 'phone_number requis', 400);
      if (String(phone_number).replace(/\D/g, '').length < 9) return resp.error(res, 'Numéro de téléphone invalide', 400);
      resp.success(res, await svc.requestOtp(phone_country, phone_number));
    } catch(e) { E(res, next, e); }
  }

  async verifyOtp(req, res, next) {
    try {
      const { phone_country = '+212', phone_number, otp } = req.body;
      if (!phone_number || !otp) return resp.error(res, 'phone_number et otp requis', 400);
      resp.success(res, await svc.verifyOtp(phone_country, phone_number, otp), 'Compte vérifié avec succès');
    } catch(e) { E(res, next, e); }
  }
}

module.exports = new CustomerAuthController();
