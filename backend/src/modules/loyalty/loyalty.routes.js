const { Router } = require('express');
const resp = require('../../utils/response');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');
const customerAuth = require('../../middlewares/customer_auth.middleware');
const ctrl = require('./loyalty.controller');

/**
 * /api/loyalty — back-office Fidélité (+ une route app mobile historique).
 *
 *  Référentiels         GET    /meta
 *  Règles de points     GET    /points-rules            (points_rules.view)
 *                       GET    /points-rules/:id
 *                       POST   /points-rules            (points_rules.manage)
 *                       PUT    /points-rules/:id
 *                       PATCH  /points-rules/:id/activate | /deactivate
 *                       DELETE /points-rules/:id        (soft-delete)
 *  Livre des points     GET    /ledger                  (points_ledger.view) — keyset ?cursor=
 *                       GET    /ledger/export
 *                       GET    /ledger/:id
 *  Rapprochement        POST   /reconciliation/run      (points_ledger.view) — SUM(livre) vs points_balance
 *  Parrainage config    GET    /referral-configs        (referrals.view)
 *                       GET    /referral-configs/:id
 *                       POST   /referral-configs        (referrals.manage)
 *                       PUT    /referral-configs/:id    (refusé si déjà référencée)
 *                       PATCH  /referral-configs/:id/activate | /deactivate
 *  Parrainage suivi     GET    /referrals               (referrals.view)
 *                       GET    /referrals/export
 *                       GET    /referrals/:id
 *  Fiche client         GET    /customers/:id/ledger    (customers.view | points_ledger.view)
 *                       GET    /customers/:id/ledger/export
 *                       POST   /customers/:id/adjust    (customers.points.adjust | customers.update)
 *                       GET    /customers/:id/referrals (customers.view | referrals.view)
 */

const router = Router();
const E = (res, next, e) => (e.statusCode ? resp.error(res, e.message, e.statusCode) : next(e));

// ── App mobile : mes parrainages (inchangé) ────────────────────────────────────
router.get('/my-referrals', customerAuth, async (req, res, next) => {
  try {
    const prisma = require('../../config/database');
    const data = await prisma.referral.findMany({
      where: { OR: [{ referrer_id: req.customerId }, { referee_id: req.customerId }] },
      include: {
        referrer: { select: { id: true, name: true } },
        referee: { select: { id: true, name: true } },
        status: { select: { code: true, name_fr: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    resp.success(res, data);
  } catch (e) { E(res, next, e); }
});

// ── Back-office ────────────────────────────────────────────────────────────────
const bo = Router();
bo.use(auth);

const canRulesView = perm.permAny(['points_rules.view', 'points_rules.manage']);
const canRulesManage = perm('points_rules.manage');
const canLedgerView = perm('points_ledger.view');
const canRefView = perm.permAny(['referrals.view', 'referrals.manage']);
const canRefManage = perm('referrals.manage');
const canCustomerLedger = perm.permAny(['customers.view', 'points_ledger.view', 'dashboard.view']);
const canCustomerAdjust = perm.permAny(['customers.points.adjust', 'customers.update']);
const canCustomerReferrals = perm.permAny(['customers.view', 'referrals.view', 'dashboard.view']);
const canMeta = perm.permAny([
  'points_rules.view', 'points_rules.manage', 'points_ledger.view', 'referrals.view', 'referrals.manage',
  'customers.view', 'dashboard.view',
]);

// Erreurs métier { statusCode, message } → réponse JSON propre
const wrap = (fn) => async (req, res, next) => {
  try { await fn.call(ctrl, req, res, (err) => (err && err.statusCode ? resp.error(res, err.message, err.statusCode) : next(err))); } catch (e) { E(res, next, e); }
};

bo.get('/meta', canMeta, wrap(ctrl.meta));

bo.get('/points-rules', canRulesView, wrap(ctrl.rulesIndex));
bo.get('/points-rules/:id', canRulesView, wrap(ctrl.rulesShow));
bo.post('/points-rules', canRulesManage, wrap(ctrl.rulesStore));
bo.put('/points-rules/:id', canRulesManage, wrap(ctrl.rulesUpdate));
bo.patch('/points-rules/:id/activate', canRulesManage, wrap(ctrl.rulesActivate));
bo.patch('/points-rules/:id/deactivate', canRulesManage, wrap(ctrl.rulesDeactivate));
bo.delete('/points-rules/:id', canRulesManage, wrap(ctrl.rulesDestroy));

bo.get('/ledger', canLedgerView, wrap(ctrl.ledgerIndex));
bo.get('/ledger/export', canLedgerView, wrap(ctrl.ledgerExport));
bo.get('/ledger/:id', canLedgerView, wrap(ctrl.ledgerShow));
bo.post('/reconciliation/run', canLedgerView, wrap(ctrl.reconciliationRun));

bo.get('/referral-configs', canRefView, wrap(ctrl.configsIndex));
bo.get('/referral-configs/:id', canRefView, wrap(ctrl.configsShow));
bo.post('/referral-configs', canRefManage, wrap(ctrl.configsStore));
bo.put('/referral-configs/:id', canRefManage, wrap(ctrl.configsUpdate));
bo.patch('/referral-configs/:id/activate', canRefManage, wrap(ctrl.configsActivate));
bo.patch('/referral-configs/:id/deactivate', canRefManage, wrap(ctrl.configsDeactivate));

bo.get('/referrals', canRefView, wrap(ctrl.referralsIndex));
bo.get('/referrals/export', canRefView, wrap(ctrl.referralsExport));
bo.get('/referrals/:id', canRefView, wrap(ctrl.referralsShow));

bo.get('/customers/:id/ledger', canCustomerLedger, wrap(ctrl.customerLedger));
bo.get('/customers/:id/ledger/export', canCustomerLedger, wrap(ctrl.customerLedgerExport));
bo.post('/customers/:id/adjust', canCustomerAdjust, wrap(ctrl.customerAdjust));
bo.get('/customers/:id/referrals', canCustomerReferrals, wrap(ctrl.customerReferrals));

router.use(bo);

module.exports = router;
