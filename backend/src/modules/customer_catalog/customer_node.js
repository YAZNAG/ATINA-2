const prisma = require('../../config/database');

/*
 * Node (dark store) utilisé pour afficher le catalogue client.
 *
 * Les prix (selling_rules.price), la vendabilité, le stock et les ventes flash sont
 * définis par node. L'app cliente n'envoie pas de node : on le déduit ainsi
 *   1. `?node_id=` (ou en-tête `X-Node-Id`) s'il désigne un node actif ;
 *   2. client connecté (req.customerId posé par customerAuth ou optionalCustomerAuth) : ville de son adresse par défaut,
 *      puis ville de sa fiche client → node actif de cette ville (le plus proche si
 *      coordonnées connues) — même rapprochement par ville que le checkout ;
 *   3. à défaut, le premier node actif (created_at asc).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

const NODE_WHERE  = { is_active: true, is_deleted: false, deleted_at: null };
const NODE_SELECT = {
  id: true, code: true, name_fr: true, name_ar: true, city_id: true, lat: true, lng: true,
  city: { select: { name_fr: true } },
};

function normalizeCity(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (x) => (Number(x) * Math.PI) / 180;
  const dLat = toRad(lat2) - toRad(lat1);
  const dLon = toRad(lon2) - toRad(lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const publicNode = (n, source) => (n ? { id: n.id, code: n.code, name_fr: n.name_fr, name_ar: n.name_ar, source } : null);

function pickInCity(nodes, place) {
  if (!place) return null;
  let inCity = place.city_id ? nodes.filter((n) => n.city_id === place.city_id) : [];
  if (!inCity.length && place.city) {
    const c = normalizeCity(place.city);
    inCity = nodes.filter((n) => normalizeCity(n.city?.name_fr) === c);
  }
  if (!inCity.length) return null;
  if (place.lat != null && place.lng != null) {
    const located = inCity.filter((n) => n.lat != null && n.lng != null);
    if (located.length) {
      return located
        .map((n) => ({ n, d: distanceKm(place.lat, place.lng, n.lat, n.lng) }))
        .sort((a, b) => a.d - b.d)[0].n;
    }
  }
  return inCity[0];
}

/**
 * @returns {Promise<{id,code,name_fr,name_ar,source}|null>} null si aucun node actif.
 * Mis en cache sur la requête.
 */
async function resolveCatalogNode(req) {
  if (req._catalogNode !== undefined) return req._catalogNode;

  const done = (node) => {
    req._catalogNode = node;
    if (node && typeof req.res?.setHeader === 'function' && !req.res.headersSent) {
      req.res.setHeader('X-Catalog-Node-Id', node.id);
    }
    return node;
  };

  const wanted = req.query?.node_id || req.headers?.['x-node-id'];
  if (isUuid(wanted)) {
    const n = await prisma.node.findFirst({ where: { id: wanted, ...NODE_WHERE }, select: NODE_SELECT });
    if (n) return done(publicNode(n, 'query'));
  }

  const nodes = await prisma.node.findMany({ where: NODE_WHERE, select: NODE_SELECT, orderBy: { created_at: 'asc' } });
  if (!nodes.length) return done(null);

  const customerId = req.customerId ?? null;
  if (customerId) {
    const customer = await prisma.customer.findUnique({
      where:  { id: customerId },
      select: {
        city_id: true, city: true, lat: true, lng: true,
        addresses: {
          where:   { is_deleted: false },
          orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
          take:    1,
          select:  { city_id: true, city: true, lat: true, lng: true },
        },
      },
    });
    const fromAddress = pickInCity(nodes, customer?.addresses?.[0]);
    if (fromAddress) return done(publicNode(fromAddress, 'address'));
    const fromCustomer = pickInCity(nodes, customer);
    if (fromCustomer) return done(publicNode(fromCustomer, 'customer_city'));
  }

  return done(publicNode(nodes[0], 'default'));
}

module.exports = { resolveCatalogNode, isUuid };
