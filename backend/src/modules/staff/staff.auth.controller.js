const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { secret, expiresIn } = require('../../config/jwt');
const response = require('../../utils/response');
const pickerRepo = require('./pickers/picker.repository');
const driverRepo = require('./drivers/driver.repository');

const makeToken = (payload) => jwt.sign(payload, secret, { expiresIn });

class StaffAuthController {
  async pickerLogin(req, res) {
    try {
      const { phone_country = '+212', phone_number, password } = req.body;
      if (!phone_number || !password) return response.error(res, 'phone_number et password requis', 400);

      const picker = await pickerRepo.findByPhone(phone_country, phone_number.replace(/^0/, ''));
      if (!picker)           return response.error(res, 'Identifiants invalides', 401);
      if (picker.is_deleted) return response.error(res, 'Compte supprimé', 403);
      if (!picker.is_active) return response.error(res, 'Compte inactif', 403);

      const valid = await bcrypt.compare(password, picker.password_hash);
      if (!valid) return response.error(res, 'Identifiants invalides', 401);

      const token = makeToken({ id: picker.id, profile_type: 'picker', role: 'picker', node_id: picker.node_id });
      const { password_hash: _, ...safe } = picker;
      return response.success(res, { token, picker: { ...safe, profile_type: 'picker', role: 'picker' } });
    } catch (e) { return response.error(res, e.message, 500); }
  }

  async driverLogin(req, res) {
    try {
      const { phone_country = '+212', phone_number, password } = req.body;
      if (!phone_number || !password) return response.error(res, 'phone_number et password requis', 400);

      const driver = await driverRepo.findByPhone(phone_country, phone_number.replace(/^0/, ''));
      if (!driver)           return response.error(res, 'Identifiants invalides', 401);
      if (driver.is_deleted) return response.error(res, 'Compte supprimé', 403);
      if (!driver.is_active) return response.error(res, 'Compte inactif', 403);

      const valid = await bcrypt.compare(password, driver.password_hash);
      if (!valid) return response.error(res, 'Identifiants invalides', 401);

      const token = makeToken({ id: driver.id, profile_type: 'driver', role: 'driver', node_id: driver.node_id });
      const { password_hash: _, ...safe } = driver;
      return response.success(res, { token, driver: { ...safe, profile_type: 'driver', role: 'driver' } });
    } catch (e) { return response.error(res, e.message, 500); }
  }
}

module.exports = new StaffAuthController();
