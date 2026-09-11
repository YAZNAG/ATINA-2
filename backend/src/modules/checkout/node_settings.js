/**
 * Paramètres de commande effectifs d'un node (WF #10, #20, #21 — US-093).
 *
 * Source de vérité : colonnes nodes.delivery_fee / nodes.min_order_amount /
 * nodes.slot_selection_enabled. Repli sur app_configs (config propre au node,
 * sinon config globale) UNIQUEMENT si la colonne vaut 0 et qu'une config
 * existe, pour ne pas casser le paramétrage historique.
 */
const prisma = require('../../config/database');

async function getAppConfigMap(node_id = null) {
  const rows = await prisma.appConfig.findMany({
    where: node_id ? { OR: [{ node_id: null }, { node_id }] } : { node_id: null },
  });
  // La config propre au node prime sur la config globale.
  const globalRows = rows.filter((r) => r.node_id === null);
  const nodeRows = rows.filter((r) => r.node_id !== null);
  const map = {};
  for (const r of globalRows) map[r.config_key] = r.config_value;
  for (const r of nodeRows) map[r.config_key] = r.config_value;
  return map;
}

function num(v, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @returns {Promise<{node_id, delivery_fee, min_order_amount, slot_selection_enabled,
 *   free_delivery_threshold, sources: {delivery_fee, min_order_amount}, configs}>}
 */
async function getNodeOrderSettings(node_id) {
  if (!node_id) throw { statusCode: 400, message: 'node_id requis' };
  const node = await prisma.node.findFirst({
    where: { id: node_id, is_deleted: false },
    select: {
      id: true, code: true, name_fr: true, timezone: true,
      delivery_fee: true, min_order_amount: true, slot_selection_enabled: true,
    },
  });
  if (!node) throw { statusCode: 404, message: 'Node introuvable' };

  const configs = await getAppConfigMap(node_id);

  let delivery_fee = num(node.delivery_fee);
  let feeSource = 'node';
  if (delivery_fee === 0) {
    const cfg = configs.delivery_fee ?? configs.delivery_fee_home;
    if (cfg !== undefined && num(cfg) > 0) { delivery_fee = num(cfg); feeSource = 'app_config'; }
  }

  let min_order_amount = num(node.min_order_amount);
  let minSource = 'node';
  if (min_order_amount === 0 && configs.min_order_amount !== undefined && num(configs.min_order_amount) > 0) {
    min_order_amount = num(configs.min_order_amount);
    minSource = 'app_config';
  }

  return {
    node_id: node.id,
    node_code: node.code,
    node_name: node.name_fr,
    timezone: node.timezone || 'Africa/Casablanca',
    delivery_fee: Math.round(delivery_fee * 100) / 100,
    min_order_amount: Math.round(min_order_amount * 100) / 100,
    slot_selection_enabled: node.slot_selection_enabled !== false,
    free_delivery_threshold: num(configs.free_delivery_threshold),
    sources: { delivery_fee: feeSource, min_order_amount: minSource },
    configs,
  };
}

module.exports = { getNodeOrderSettings, getAppConfigMap };
