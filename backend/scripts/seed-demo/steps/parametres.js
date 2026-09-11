/**
 * Étape « parametres » : paramètres applicatifs globaux (app_configs, node_id NULL).
 * Une clé déjà présente n'est jamais écrasée.
 */
const CONFIGS = [
  ['maintenance_mode', 'false', 'boolean', 'Mode maintenance de l’app client (bloque les commandes si true)'],
  ['support_phone', '+212600000999', 'string', 'Numéro du service client affiché dans l’app (fictif)'],
  ['support_email', 'support@example.com', 'string', 'Adresse e-mail du service client (fictive)'],
  ['app_min_version', '1.0.0', 'string', 'Version minimale de l’app mobile acceptée'],
  ['currency', 'MAD', 'string', 'Devise des prix'],
  ['default_language', 'fr', 'string', 'Langue par défaut de l’app (fr / ar)'],
  ['free_delivery_threshold', '300', 'decimal', 'Livraison offerte à partir de ce sous-total TTC (MAD)'],
  ['cod_max_amount', '2000', 'decimal', 'Montant maximum autorisé en paiement à la livraison (MAD)'],
  ['order_cancel_window_minutes', '10', 'integer', 'Délai pendant lequel le client peut annuler sa commande'],
  ['picking_sla_minutes', '15', 'integer', 'Objectif de temps de préparation d’une commande'],
  ['points_expiry_months', '12', 'integer', 'Durée de validité des points fidélité'],
  ['notifications_sms_enabled', 'true', 'boolean', 'Envoi des notifications SMS (OTP, statut de commande)'],
];

async function run(ctx) {
  const { prisma } = ctx;
  const admin = await ctx.admin();
  const types = await ctx.byCode('configValueType');
  for (const [key, value, type, description] of CONFIGS) {
    const exists = await prisma.appConfig.findFirst({ where: { node_id: null, config_key: key } });
    if (exists) continue;
    ctx.count('app_configs');
    if (ctx.dry || !admin) continue;
    await prisma.appConfig.create({ data: { node_id: null, config_key: key, config_value: value, value_type_id: types[type].id, description, updated_by: admin.id } });
  }
}

module.exports = { name: 'parametres', label: 'Paramètres applicatifs', run };
