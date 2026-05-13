const svc  = require('./customer_auth.service');
const resp = require('../../utils/response');
const jwt  = require('jsonwebtoken');
const { secret } = require('../../config/jwt');

const E = (res, next, e) => {
  if (e.statusCode) return resp.error(res, e.message, e.statusCode);
  next(e);
};

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
      if (String(phone_number).replace(/\D/g, '').length < 9) return resp.error(res, 'Numéro invalide', 400);
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

  async register(req, res, next) {
    try {
      const { phone_country = '+212', phone_number, full_name, password, email } = req.body;
      if (!phone_number) return resp.error(res, 'phone_number requis', 400);
      if (!full_name)    return resp.error(res, 'full_name requis', 400);
      if (!password || password.length < 6) return resp.error(res, 'Mot de passe minimum 6 caractères', 400);
      resp.success(res, await svc.register(phone_country, phone_number, full_name, password, email), 'Compte créé avec succès');
    } catch(e) { E(res, next, e); }
  }

  async login(req, res, next) {
    try {
      const { phone_country = '+212', phone_number, password } = req.body;
      if (!phone_number) return resp.error(res, 'phone_number requis', 400);
      if (!password)     return resp.error(res, 'password requis', 400);
      resp.success(res, await svc.login(phone_country, phone_number, password), 'Connexion réussie');
    } catch(e) { E(res, next, e); }
  }

  async me(req, res, next) {
    try {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.toLowerCase().startsWith('bearer '))
        return resp.error(res, 'Token requis', 401);

      const token = authHeader.split(' ')[1];
      let decoded;
      try { decoded = jwt.verify(token, secret); }
      catch { return resp.error(res, 'Token invalide ou expiré', 401); }

      resp.success(res, await svc.getMe(decoded.id));
    } catch(e) { E(res, next, e); }
  }
}

module.exports = new CustomerAuthController();
