const repo = require('./app_config.repository');

class AppConfigService {
  async getAll(params) {
    return repo.findAll(params);
  }

  async save(data, userId) {
    const { node_id, config_key, config_value, value_type_code, description } = data;
    if (!config_key?.trim()) throw { statusCode: 400, message: 'Clé de configuration requise' };
    if (config_value === undefined || config_value === null || config_value === '')
      throw { statusCode: 400, message: 'Valeur requise' };
    return repo.save({ node_id, config_key, config_value, value_type_code, description, updated_by: userId });
  }

  async delete(id) {
    await repo.remove(id);
  }

  async seedDefaults(userId) {
    return repo.seedGlobalDefaults(userId);
  }

  getOrderRuleKeys()  { return repo.ORDER_RULE_KEYS; }
  getPaymentKeys()    { return repo.PAYMENT_KEYS; }
}

module.exports = new AppConfigService();
