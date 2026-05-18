const { Router } = require('express');
const svc  = require('./loyalty.service');
const resp = require('../../utils/response');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');
const customerAuth = require('../../middlewares/customer_auth.middleware');

const router = Router();
const E = (res, next, e) => e.statusCode ? resp.error(res, e.message, e.statusCode) : next(e);

// ── Admin: list referrals ──────────────────────────────────────────────────────
router.get('/referrals', auth, perm.permAny(['dashboard.view']), async (req, res, next) => {
  try {
    const prisma = require('../../config/database');
    const data = await prisma.referral.findMany({
      include: {
        referrer: { select: { id: true, name: true, phone_number: true } },
        referee:  { select: { id: true, name: true, phone_number: true } },
        status:   { select: { code: true, name_fr: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    resp.success(res, data);
  } catch(e) { E(res, next, e); }
});

// ── Customer: my referrals ─────────────────────────────────────────────────────
router.get('/my-referrals', customerAuth, async (req, res, next) => {
  try {
    const prisma = require('../../config/database');
    const data = await prisma.referral.findMany({
      where: { OR: [{ referrer_id: req.customerId }, { referee_id: req.customerId }] },
      include: {
        referrer: { select: { id: true, name: true } },
        referee:  { select: { id: true, name: true } },
        status:   { select: { code: true, name_fr: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    resp.success(res, data);
  } catch(e) { E(res, next, e); }
});

module.exports = router;
