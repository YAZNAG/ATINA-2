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

// ── Admin: grand-livre de points d'un client ───────────────────────────────────
router.get('/customers/:id/ledger', auth, perm.permAny(['dashboard.view']), async (req, res, next) => {
  try {
    const prisma = require('../../config/database');
    const { id } = req.params;
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip  = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.pointsTransaction.findMany({
        where: { customer_id: id },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.pointsTransaction.count({ where: { customer_id: id } }),
    ]);

    resp.success(res, {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    });
  } catch (e) { E(res, next, e); }
});

// ── Admin: ajustement manuel du solde de points ────────────────────────────────
router.post('/customers/:id/adjust', auth, perm.permAny(['customers.points.adjust']), async (req, res, next) => {
  try {
    const prisma = require('../../config/database');
    const { id } = req.params;
    const points = Number(req.body.points);
    const label  = (req.body.label && String(req.body.label).trim()) || '';

    if (!Number.isFinite(points) || points === 0) {
      return resp.error(res, 'Montant de points invalide', 400);
    }
    if (!label) {
      return resp.error(res, 'Motif requis', 400);
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, points_balance: true, is_deleted: true },
    });
    if (!customer || customer.is_deleted) return resp.error(res, 'Client introuvable', 404);

    const newBalance = Number(customer.points_balance ?? 0) + points;
    if (newBalance < 0) return resp.error(res, 'Solde de points insuffisant pour cet ajustement', 400);

    const [updated, txn] = await prisma.$transaction(async (tx) => {
      const upd = await tx.customer.update({
        where: { id },
        data: {
          points_balance: { increment: points },
          // points_lifetime ne compte que les points gagnés, jamais les retraits
          ...(points > 0 ? { points_lifetime: { increment: points } } : {}),
        },
      });

      const created = await tx.pointsTransaction.create({
        data: {
          customer_id: id,
          order_id: null,
          type: 'manual_adjustment',
          points,
          balance_after: upd.points_balance,
          label,
        },
      });

      return [upd, created];
    });

    resp.success(res, { points_balance: updated.points_balance, transaction: txn }, 'Solde ajusté');
  } catch (e) { E(res, next, e); }
});

// ── Admin: parrainages d'un client (parrain + filleuls) ────────────────────────
router.get('/customers/:id/referrals', auth, perm.permAny(['dashboard.view']), async (req, res, next) => {
  try {
    const prisma = require('../../config/database');
    const { id } = req.params;

    const [customer, filleuls] = await Promise.all([
      prisma.customer.findUnique({
        where: { id },
        select: {
          referred_by: { select: { id: true, name: true, phone_number: true, referral_code: true } },
        },
      }),
      prisma.referral.findMany({
        where: { referrer_id: id },
        include: {
          referee: { select: { id: true, name: true, phone_number: true } },
          status:  { select: { code: true, name_fr: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    if (!customer) return resp.error(res, 'Client introuvable', 404);

    resp.success(res, {
      parrain: customer.referred_by ?? null,
      filleuls,
    });
  } catch (e) { E(res, next, e); }
});

module.exports = router;
