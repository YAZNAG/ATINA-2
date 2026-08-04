const prisma = require('../../config/database');

let _cache = { data: null, expiresAt: 0 };

async function getRedemptionConfig(node_id = null) {
    console.log('[getRedemptionConfig] called with node_id:', node_id);
  const now = Date.now();
  if (_cache.data && _cache.data.node_id === node_id && now < _cache.expiresAt) {
    return _cache.data;
  }

  const nowDate = new Date();
  const rule = await prisma.pointsRule.findFirst({
    where: {
      is_active: true,
      valid_from: { lte: nowDate },
      AND: [
        { OR: [{ valid_to: null }, { valid_to: { gte: nowDate } }] },
        { OR: [{ node_id: null }, { node_id }] },
      ],
      rule_type: { code: 'REDEMPTION' },
    },
    orderBy: { node_id: { sort: 'desc', nulls: 'last' } },
    include: {
      rule_type:   { select: { code: true } },
      reward_type: { select: { code: true } },
    },
  });

  if (!rule) {
    throw { statusCode: 500, message: 'Configuration de rachat de points introuvable.' };
  }
  if (!rule.reward_type) {
    throw { statusCode: 500, message: `Le rule de rachat ${rule.id} n'a pas de reward_type configuré.` };
  }

  console.log('[getRedemptionConfig] resolved:', { milestone_step: rule.points_value, reward_type: rule.reward_type.code });

  const milestone_step = rule.points_value;
  const redeem_mad     = Number(rule.per_mad_spent ?? 0);
  const points_per_mad = redeem_mad > 0 ? milestone_step / redeem_mad : 0;

  const config = {
    node_id,
    milestone_step,
    redeem_mad,
    points_per_mad,
    reward_type_code: rule.reward_type.code,
    rule_id: rule.id,
  };

  _cache = { data: config, expiresAt: now + 5 * 60 * 1000 };
  return config;
}

function clearRedemptionConfigCache() {
  _cache = { data: null, expiresAt: 0 };
}

module.exports = { getRedemptionConfig, clearRedemptionConfigCache };