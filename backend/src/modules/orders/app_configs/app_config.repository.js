const prisma = require('../../../config/database');

const seedValueTypes = () => prisma.$transaction([
  prisma.configValueType.upsert({ where: { code: 'string'  }, update: {}, create: { code: 'string',  name_fr: 'Texte',   name_ar: 'نص'      } }),
  prisma.configValueType.upsert({ where: { code: 'number'  }, update: {}, create: { code: 'number',  name_fr: 'Nombre',  name_ar: 'رقم'     } }),
  prisma.configValueType.upsert({ where: { code: 'boolean' }, update: {}, create: { code: 'boolean', name_fr: 'Booléen', name_ar: 'منطقي'   } }),
]);

const getValueTypeId = async (code) => {
  const vt = await prisma.configValueType.findFirst({ where: { code: code || 'string' } });
  if (!vt) {
    await seedValueTypes();
    const vt2 = await prisma.configValueType.findFirst({ where: { code: code || 'string' } });
    return vt2?.id;
  }
  return vt.id;
};

const ORDER_RULE_KEYS = [
  { key: 'min_order_amount',  type: 'number',  label_fr: 'Montant minimum commande (DH)',   default: '50' },
  { key: 'delivery_fee',      type: 'number',  label_fr: 'Frais de livraison (DH)',          default: '0'  },
  { key: 'cod_max_amount',    type: 'number',  label_fr: 'Montant max COD (DH)',             default: '5000' },
  { key: 'slot_duration_min', type: 'number',  label_fr: 'Durée créneau (minutes)',          default: '120' },
  { key: 'maintenance_mode',  type: 'boolean', label_fr: 'Mode maintenance',                 default: 'false' },
];

const PAYMENT_KEYS = [
  { key: 'payment_method_cod',    type: 'boolean', label_fr: 'Paiement à la livraison (COD)', default: 'true'  },
  { key: 'payment_method_wallet', type: 'boolean', label_fr: 'Paiement Wallet',               default: 'false' },
  { key: 'payment_method_mixed',  type: 'boolean', label_fr: 'Paiement mixte',                default: 'false' },
];

const findAll = async ({ node_id, keys } = {}) => {
  const where = {};
  if (node_id !== undefined) where.node_id = node_id || null;
  if (keys) where.config_key = { in: keys.split(',') };
  return prisma.appConfig.findMany({ where, include: { value_type: true, node: { select: { id: true, name_fr: true, code: true } } }, orderBy: { config_key: 'asc' } });
};

const findByKeyAndNode = (config_key, node_id) =>
  prisma.appConfig.findFirst({ where: { config_key, node_id: node_id || null } });

const save = async ({ node_id, config_key, config_value, value_type_code, description, updated_by }) => {
  const value_type_id = await getValueTypeId(value_type_code);
  if (!value_type_id) throw { statusCode: 500, message: 'Type de valeur introuvable' };
  const existing = await findByKeyAndNode(config_key, node_id || null);
  const data = { config_value: String(config_value), value_type_id, description: description || null, updated_by: parseInt(updated_by || 1) };
  if (existing) return prisma.appConfig.update({ where: { id: existing.id }, data });
  return prisma.appConfig.create({ data: { ...data, node_id: node_id || null, config_key } });
};

const remove = (id) => prisma.appConfig.delete({ where: { id } });

const seedGlobalDefaults = async (updated_by = 1) => {
  await seedValueTypes();
  const allKeys = [...ORDER_RULE_KEYS, ...PAYMENT_KEYS];
  for (const { key, type, default: def } of allKeys) {
    await save({ node_id: null, config_key: key, config_value: def, value_type_code: type, updated_by });
  }
  return { seeded: allKeys.length };
};

module.exports = { findAll, findByKeyAndNode, save, remove, seedValueTypes, seedGlobalDefaults, ORDER_RULE_KEYS, PAYMENT_KEYS };
