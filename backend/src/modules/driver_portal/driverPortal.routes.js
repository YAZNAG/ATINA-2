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
const {
  PRIMARY_IMAGE_SELECT, primaryImageUrl, resolveSkuPrice,
} = require('../customer_cart/customer_cart.shared');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Champs SKU exposés au livreur (articles fusionnés dans skus : nom / code / EAN sur le SKU).
const DRIVER_SKU_SELECT = {
  id: true, sku_code: true, ean13: true, name_fr: true, name_ar: true,
  unit_sale: true, weight_g: true, volume_ml: true, vat_rate: true, price: true,
  tax:           { select: { rate: true } },
  images:        PRIMARY_IMAGE_SELECT,
  selling_rules: { select: { node_id: true, price: true, is_sellable: true } },
};

/** SKU « à plat » + alias `article` (ancien format) ; prix = selling_rules.price du node de la commande. */
function formatDriverSku(sku, nodeId) {
  if (!sku) return null;
  const { images, selling_rules, tax, ...rest } = sku;
  const price = resolveSkuPrice(sku, nodeId);
  const image_url = primaryImageUrl(sku);
  return {
    ...rest,
    price:     price.price_ttc,
    price_ttc: price.price_ttc,
    vat_rate:  price.vat_rate,
    image_url,
    article: {
      id: sku.id, name_fr: sku.name_fr, name_ar: sku.name_ar,
      sku_code: sku.sku_code, ean13: sku.ean13, price: price.price_ttc, image_url,
    },
  };
}

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
    if (!UUID_RE.test(String(req.params.id))) return resp.error(res, 'Tournée introuvable', 404);
    const tour = await deliverySvc.getTour(req.params.id);
    if (tour.driver_id !== req.driver.id)
      return resp.error(res, 'Tournée non assignée à ce chauffeur', 403);
    resp.success(res, tour);
  } catch(e) { E(res, next, e); }
});

// ── Start tour (driver-facing) ────────────────────────────────────────────────
router.patch('/tours/:id/start', async (req, res, next) => {
  try {
    if (!UUID_RE.test(String(req.params.id))) return resp.error(res, 'Tournée introuvable', 404);
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
              include: {
                sku:  { select: DRIVER_SKU_SELECT },
                pack: { select: { id: true, name_fr: true } },
              },
            },
          },
        },
      },
    });
    if (!stop) return resp.error(res, 'Stop introuvable', 404);
    if (stop.order) {
      const nodeId = stop.order.node_id;
      stop.order.items = (stop.order.items ?? []).map((it) => ({
        ...it,
        name_fr: it.sku?.name_fr ?? it.pack?.name_fr ?? 'Article',
        sku: formatDriverSku(it.sku, nodeId),
      }));
    }
    resp.success(res, stop);
  } catch(e) { E(res, next, e); }
});

// ── Stop actions ──────────────────────────────────────────────────────────────
async function getStopForDriver(stopId, driverId) {
  if (!UUID_RE.test(String(stopId))) throw { statusCode: 404, message: 'Stop introuvable' };
  const stop = await prisma.tourStop.findUnique({
    where: { id: stopId },
    include: { tour: { select: { driver_id: true, status: { select: { code: true } } } } },
  });
  if (!stop) throw { statusCode: 404, message: 'Stop introuvable' };
  if (stop.tour.driver_id !== driverId) throw { statusCode: 403, message: 'Stop non assigné à ce chauffeur' };
  return stop;
}

// ── Scan EAN d'un produit de l'arrêt (contrôle à la remise) ─────────────────────
// Body : { ean } (ou ean13 / code). Cherche skus.ean13 puis les lignes de la commande de l'arrêt.
router.post('/stops/:stopId/scan', async (req, res, next) => {
  try {
    const stop = await getStopForDriver(req.params.stopId, req.driver.id);
    if (!stop.order_id) return resp.error(res, 'Aucune commande liée à cet arrêt', 422);

    const ean = String(req.body?.ean ?? req.body?.ean13 ?? req.body?.code ?? '').trim();
    if (!/^\d{8,14}$/.test(ean)) return resp.error(res, 'Code EAN invalide (8 à 14 chiffres)', 400);

    const sku = await prisma.sku.findFirst({
      where:  { ean13: ean, is_deleted: false },
      select: DRIVER_SKU_SELECT,
    });
    if (!sku) return resp.error(res, `Aucun produit ne correspond au code EAN ${ean}`, 404);

    const order = await prisma.order.findUnique({ where: { id: stop.order_id }, select: { node_id: true } });
    const lines = await prisma.orderItem.findMany({
      where:   { order_id: stop.order_id, sku_id: sku.id },
      include: { status: { select: { code: true, name_fr: true } }, pack: { select: { id: true, name_fr: true } } },
    });
    const qtyOrdered = lines.reduce((s, l) => s + Number(l.qty ?? 0), 0);

    resp.success(res, {
      ean13:       ean,
      in_order:    lines.length > 0,
      qty_ordered: qtyOrdered,
      sku:         formatDriverSku(sku, order?.node_id ?? null),
      lines: lines.map((l) => ({
        id:              l.id,
        qty:             Number(l.qty ?? 0),
        unit_price_sold: Number(l.unit_price_sold ?? 0),
        pack:            l.pack ?? null,
        status:          l.status ?? null,
      })),
    }, lines.length ? 'Produit présent dans la commande' : 'Produit absent de cette commande');
  } catch(e) { E(res, next, e); }
});

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
