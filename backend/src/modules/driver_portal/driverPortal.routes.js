/**
 * Driver mobile portal — dedicated endpoints for the driver app.
 * Auth: JWT signed with driver.id (same mechanism as picker portal).
 * Driver can only see his own tours and stops.
 */
const { Router }    = require('express');
const bcrypt        = require('bcryptjs');
const jwt           = require('jsonwebtoken');
const { secret, expiresIn } = require('../../config/jwt');
const prisma        = require('../../config/database');
const deliverySvc   = require('../delivery_mgmt/delivery.service');
const resp          = require('../../utils/response');

const router = Router();

// ── Driver auth middleware ─────────────────────────────────────────────────────
function driverAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  if (!header.toLowerCase().startsWith('bearer '))
    return resp.error(res, 'Token chauffeur requis', 401);
  try {
    const decoded = jwt.verify(header.split(' ')[1], secret);
    if (decoded.profile_type !== 'driver')
      return resp.error(res, 'Token invalide (profil non driver)', 403);
    req.driver = decoded;
    next();
  } catch {
    return resp.error(res, 'Token invalide ou expiré', 401);
  }
}

const E = (res, next, e) => e.statusCode ? resp.error(res, e.message, e.statusCode) : next(e);

// ── Login ──────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { phone_country = '+212', phone_number, password } = req.body;
    if (!phone_number || !password) return resp.error(res, 'phone_number et password requis', 400);

    const phone  = phone_number.replace(/^0/, '');
    const driver = await prisma.driver.findFirst({
      where: { phone_country, phone_number: phone, is_deleted: false },
      include: { node: { select: { id: true, name_fr: true } } },
    });
    if (!driver)           return resp.error(res, 'Identifiants invalides', 401);
    if (!driver.is_active) return resp.error(res, 'Compte chauffeur inactif', 403);

    const valid = await bcrypt.compare(password, driver.password_hash);
    if (!valid) return resp.error(res, 'Identifiants invalides', 401);

    const token = jwt.sign(
      { id: driver.id, profile_type: 'driver', node_id: driver.node_id },
      secret, { expiresIn }
    );

    const { password_hash: _, ...safe } = driver;
    return resp.success(res, { token, driver: { ...safe, profile_type: 'driver' } });
  } catch (err) {
    return resp.error(res, err.message ?? 'Erreur serveur', 500);
  }
});

// ── Protect all routes below ───────────────────────────────────────────────────
router.use(driverAuth);

// ── My tours ──────────────────────────────────────────────────────────────────
router.get('/tours', async (req, res, next) => {
  try {
    const result = await deliverySvc.listTours({ driver_id: req.driver.id, limit: 20 });
    resp.success(res, result.data);
  } catch(e) { E(res, next, e); }
});

router.get('/tours/:id', async (req, res, next) => {
  try {
    const tour = await deliverySvc.getTour(req.params.id);
    if (tour.driver_id !== req.driver.id)
      return resp.error(res, 'Tournée non assignée à ce chauffeur', 403);
    resp.success(res, tour);
  } catch(e) { E(res, next, e); }
});

// ── Start tour (driver-facing) ────────────────────────────────────────────────
router.patch('/tours/:id/start', async (req, res, next) => {
  try {
    const tour = await deliverySvc.getTour(req.params.id);
    if (tour.driver_id !== req.driver.id)
      return resp.error(res, 'Tournée non assignée à ce chauffeur', 403);
    resp.success(res, await deliverySvc.startTour(req.params.id), 'Tournée démarrée');
  } catch(e) { E(res, next, e); }
});

// ── Stop detail ───────────────────────────────────────────────────────────────
router.get('/stops/:stopId', async (req, res, next) => {
  try {
    await getStopForDriver(req.params.stopId, req.driver.id);
    const stop = await prisma.tourStop.findUnique({
      where: { id: req.params.stopId },
      include: {
        status: { select: { id: true, code: true, name_fr: true } },
        tour: { select: { id: true, driver_id: true, status: { select: { code: true } } } },
        order: {
          include: {
            status:   { select: { code: true, name_fr: true, color: true } },
            customer: { select: { id: true, name: true, phone_country: true, phone_number: true } },
            address:  true,
            node:     { select: { id: true, name_fr: true } },
            payments: {
              take: 1, orderBy: { created_at: 'desc' },
              include: { payment_method: { select: { code: true, name_fr: true } }, status: { select: { code: true, name_fr: true } } },
            },
            items: {
              include: { sku: { include: { article: { select: { name_fr: true, sku_code: true, ean13: true, price: true } } } } },
            },
          },
        },
      },
    });
    if (!stop) return resp.error(res, 'Stop introuvable', 404);
    resp.success(res, stop);
  } catch(e) { E(res, next, e); }
});

// ── Stop actions ──────────────────────────────────────────────────────────────
async function getStopForDriver(stopId, driverId) {
  const stop = await prisma.tourStop.findUnique({
    where: { id: stopId },
    include: { tour: { select: { driver_id: true, status: { select: { code: true } } } } },
  });
  if (!stop) throw { statusCode: 404, message: 'Stop introuvable' };
  if (stop.tour.driver_id !== driverId) throw { statusCode: 403, message: 'Stop non assigné à ce chauffeur' };
  return stop;
}

router.patch('/stops/:stopId/arrive', async (req, res, next) => {
  try {
    await getStopForDriver(req.params.stopId, req.driver.id);
    resp.success(res, await deliverySvc.arriveStop(req.params.stopId, req.body));
  } catch(e) { E(res, next, e); }
});

router.patch('/stops/:stopId/deliver', async (req, res, next) => {
  try {
    await getStopForDriver(req.params.stopId, req.driver.id);
    resp.success(res, await deliverySvc.deliverStop(req.params.stopId, req.body), 'Livraison confirmée');
  } catch(e) { E(res, next, e); }
});

router.patch('/stops/:stopId/fail', async (req, res, next) => {
  try {
    await getStopForDriver(req.params.stopId, req.driver.id);
    resp.success(res, await deliverySvc.failStop(req.params.stopId, req.body), 'Échec enregistré');
  } catch(e) { E(res, next, e); }
});

module.exports = router;
