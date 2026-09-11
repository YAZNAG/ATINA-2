/**
 * Étape « fidelite » : règles de points (service loyalty/points-rules) et configuration
 * de parrainage active (service loyalty/referrals).
 */
const { daysAgo } = require('../lib/util');

async function run(ctx) {
  const { prisma } = ctx;
  const rulesSvc = require('../../../src/modules/loyalty/points-rules.service');
  const refSvc = require('../../../src/modules/loyalty/referrals.service');
  const req = ctx.dry ? null : await ctx.req();
  const cats = await ctx.byCode('category');
  const from = daysAgo(60, 0, 0).toISOString();

  const RULES = [
    { rule_type_code: 'per_spend', points_value: 1, per_mad_spent: 10, min_order_amount: 0, valid_from: from, is_active: true },
    { rule_type_code: 'first_order', points_value: 50, min_order_amount: 0, valid_from: from, is_active: true },
    { rule_type_code: 'category_multiplier', category: 'BIO', points_value: 2, per_mad_spent: 10, min_order_amount: 0, valid_from: from, is_active: true },
    { rule_type_code: 'flat_bonus', points_value: 20, min_order_amount: 300, valid_from: from, is_active: false },
  ];
  for (const r of RULES) {
    const type = await prisma.pointsRuleType.findUnique({ where: { code: r.rule_type_code } });
    if (!type) { ctx.warn(`Type de règle ${r.rule_type_code} absent`); continue; }
    const categoryId = r.category ? cats[r.category]?.id : null;
    const exists = await prisma.pointsRule.findFirst({ where: { rule_type_id: type.id, category_id: categoryId, is_deleted: false } });
    if (exists) continue;
    ctx.count('points_rules');
    if (ctx.dry) continue;
    const { category, ...body } = r;
    await rulesSvc.create(req, { ...body, category_id: categoryId });
  }

  // Palier de rachat lu par l'app client (customer_loyalty → loyalty.config : type « REDEMPTION »).
  // Hors écran « Règles de points » du back-office (qui ne gère que les 4 types d'attribution).
  const redemptionType = await ctx.ensure('pointsRuleType', { code: 'REDEMPTION' }, { code: 'REDEMPTION', name_fr: 'Palier de rachat (app client)', name_ar: 'عتبة استبدال النقاط' }, { table: 'points_rule_types' });
  const promoReward = await prisma.rewardType.findUnique({ where: { code: 'promo_code' } });
  if (redemptionType && !(await prisma.pointsRule.findFirst({ where: { rule_type_id: redemptionType.id, is_deleted: false } }))) {
    ctx.count('points_rules');
    if (!ctx.dry) {
      await prisma.pointsRule.create({
        data: { rule_type_id: redemptionType.id, reward_type_id: promoReward?.id ?? null, points_value: 100, per_mad_spent: 10, min_order_amount: 0, valid_from: new Date(from), is_active: true, created_by: req.user.id },
      });
    }
  }

  const cfg = await prisma.referralConfig.findFirst({ where: { is_active: true } });
  if (!cfg) {
    ctx.count('referral_config');
    if (!ctx.dry) {
      await refSvc.createConfig(req, {
        referrer_reward_type: 'points', referrer_reward_value: 100,
        referee_reward_type: 'promo_code', referee_reward_value: 20,
        promo_type_code: 'FIXED', promo_min_order_amount: 100, promo_validity_days: 30,
        min_order_amount: 100, max_referrals_per_user: 5, valid_from: from, is_active: true,
      });
    }
  }
}

module.exports = { name: 'fidelite', label: 'Règles de points et parrainage', run };
