const prisma = require('../../config/database');
const response = require('../../utils/response');
const rules = require('./points-rules.service');
const ledger = require('./points-ledger.service');
const referrals = require('./referrals.service');

/** Contrôleur back-office Fidélité : règles de points, livre des points, parrainage. */
class LoyaltyController {
  // ── Référentiels ───────────────────────────────────────────────────────────
  async meta(req, res, next) {
    try {
      const [ruleTypes, rewardTypes, promoTypes, referralStatuses, categories] = await Promise.all([
        prisma.pointsRuleType.findMany({
          where: { code: { in: ['per_spend', 'flat_bonus', 'category_multiplier', 'first_order'] } },
          orderBy: { code: 'asc' },
        }),
        prisma.rewardType.findMany({ where: { code: { in: ['points', 'promo_code'] } }, orderBy: { code: 'asc' } }),
        prisma.promoType.findMany({ orderBy: { code: 'asc' } }),
        prisma.referralStatus.findMany({ orderBy: { code: 'asc' } }),
        prisma.category.findMany({
          where: { is_deleted: false },
          select: { id: true, code: true, name_fr: true, name_ar: true, is_active: true },
          orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }],
        }),
      ]);
      return response.success(res, {
        rule_types: ruleTypes,
        reward_types: rewardTypes,
        promo_types: promoTypes,
        referral_statuses: referralStatuses,
        categories,
        txn_types: ledger.txnTypes(),
      });
    } catch (err) { return next(err); }
  }

  // ── Règles de points ───────────────────────────────────────────────────────
  async rulesIndex(req, res, next) {
    try {
      const { data, pagination } = await rules.list(req.query);
      return res.json({ success: true, message: 'Success', data, pagination });
    } catch (err) { return next(err); }
  }

  async rulesShow(req, res, next) {
    try { return response.success(res, await rules.get(req.params.id)); } catch (err) { return next(err); }
  }

  async rulesStore(req, res, next) {
    try { return response.success(res, await rules.create(req, req.body), 'Règle de points créée', 201); } catch (err) { return next(err); }
  }

  async rulesUpdate(req, res, next) {
    try {
      return response.success(res, await rules.update(req, req.params.id, req.body), 'Règle mise à jour — effet sur les prochaines commandes livrées uniquement');
    } catch (err) { return next(err); }
  }

  async rulesActivate(req, res, next) {
    try { return response.success(res, await rules.setActive(req, req.params.id, true), 'Règle activée'); } catch (err) { return next(err); }
  }

  async rulesDeactivate(req, res, next) {
    try { return response.success(res, await rules.setActive(req, req.params.id, false), 'Règle désactivée'); } catch (err) { return next(err); }
  }

  async rulesDestroy(req, res, next) {
    try { return response.success(res, await rules.remove(req, req.params.id), 'Règle supprimée'); } catch (err) { return next(err); }
  }

  // ── Livre des points ───────────────────────────────────────────────────────
  async ledgerIndex(req, res, next) {
    try { return response.success(res, await ledger.list(req.query)); } catch (err) { return next(err); }
  }

  async ledgerExport(req, res, next) {
    try { return response.success(res, await ledger.exportRows(req.query)); } catch (err) { return next(err); }
  }

  async ledgerShow(req, res, next) {
    try { return response.success(res, await ledger.detail(req.params.id)); } catch (err) { return next(err); }
  }

  // ── Fiche client ───────────────────────────────────────────────────────────
  async customerLedger(req, res, next) {
    try {
      const [header, page] = await Promise.all([
        ledger.customerHeader(req.params.id),
        ledger.list(req.query, req.params.id),
      ]);
      return response.success(res, {
        points_balance: header.points_balance,
        points_lifetime: header.points_lifetime,
        ...page,
      });
    } catch (err) { return next(err); }
  }

  async customerLedgerExport(req, res, next) {
    try { return response.success(res, await ledger.exportRows(req.query, req.params.id)); } catch (err) { return next(err); }
  }

  async customerAdjust(req, res, next) {
    try { return response.success(res, await ledger.adjust(req, req.params.id, req.body), 'Points ajustés', 201); } catch (err) { return next(err); }
  }

  async customerReferrals(req, res, next) {
    try { return response.success(res, await referrals.customerReferrals(req.params.id, req.query)); } catch (err) { return next(err); }
  }

  // ── Parrainage : configurations ────────────────────────────────────────────
  async configsIndex(req, res, next) {
    try { return response.success(res, await referrals.listConfigs()); } catch (err) { return next(err); }
  }

  async configsShow(req, res, next) {
    try { return response.success(res, await referrals.getConfig(req.params.id)); } catch (err) { return next(err); }
  }

  async configsStore(req, res, next) {
    try { return response.success(res, await referrals.createConfig(req, req.body), 'Configuration de parrainage créée', 201); } catch (err) { return next(err); }
  }

  async configsUpdate(req, res, next) {
    try { return response.success(res, await referrals.updateConfig(req, req.params.id, req.body), 'Configuration mise à jour'); } catch (err) { return next(err); }
  }

  async configsActivate(req, res, next) {
    try {
      return response.success(res, await referrals.setConfigActive(req, req.params.id, true), 'Configuration activée — la configuration précédente a été désactivée');
    } catch (err) { return next(err); }
  }

  async configsDeactivate(req, res, next) {
    try { return response.success(res, await referrals.setConfigActive(req, req.params.id, false), 'Configuration désactivée'); } catch (err) { return next(err); }
  }

  // ── Parrainage : suivi ─────────────────────────────────────────────────────
  async referralsIndex(req, res, next) {
    try {
      const { data, pagination } = await referrals.listReferrals(req.query);
      return res.json({ success: true, message: 'Success', data, pagination });
    } catch (err) { return next(err); }
  }

  async referralsExport(req, res, next) {
    try { return response.success(res, await referrals.exportReferrals(req.query)); } catch (err) { return next(err); }
  }

  async referralsShow(req, res, next) {
    try { return response.success(res, await referrals.referralDetail(req.params.id)); } catch (err) { return next(err); }
  }
}

module.exports = new LoyaltyController();
