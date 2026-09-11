/**
 * Point Exchange — CÔTÉ CLIENT (app mobile) : catalogue « Échanger mes points » et
 * contrôles des lignes d'échange au checkout (WF #19 parties A et B, US-088,
 * FAQ « Quand débiter les points d'échange »).
 *
 *  - catalogue : règles actives du node (points_exchange_skus), SKU actif, vendable
 *    (selling_rules.is_sellable) et en stock (qty_available > 0) ; coût en points,
 *    quantité max par commande et solde du client ;
 *  - AVANT confirmation : l'échange n'existe que dans le panier de l'app — rien n'est écrit ;
 *  - À la confirmation (checkout.service.createOrder) : validateExchangeItems est rejoué dans
 *    la transaction (règle active sur le node, qty ≤ max_qty_per_order, stock, solde) puis
 *    les lignes sont créées (is_points_exchange, unit_price_sold = 0, points_spent figé) et
 *    UNE transaction sku_exchange est écrite via recordPointsTxn.
 */
const prisma = require('../../config/database');
const { toPublicUrl } = require('../../utils/fileStorage');
const { resolveCustomerNodeId } = require('../customer_cart/customer_cart.shared');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const err = (statusCode, message) => ({ statusCode, message });
const round2 = (n) => Math.round(Number(n) * 100) / 100;

/** Regroupe les lignes par SKU ; quantités entières > 0. */
function normalizeExchangeItems(raw) {
  if (raw == null || raw === '') return [];
  if (!Array.isArray(raw)) throw err(400, 'exchange_items : tableau attendu');
  const bySku = new Map();
  raw.forEach((it, i) => {
    const sku_id = String(it?.sku_id ?? '').trim();
    const qty = Number(it?.qty ?? it?.quantity ?? 1);
    if (!UUID_RE.test(sku_id)) throw err(400, `exchange_items[${i}] : sku_id invalide`);
    if (!Number.isInteger(qty) || qty <= 0) throw err(400, `exchange_items[${i}] : quantité entière > 0 attendue`);
    bySku.set(sku_id, (bySku.get(sku_id) || 0) + qty);
  });
  return [...bySku].map(([sku_id, qty]) => ({ sku_id, qty }));
}

/**
 * Contrôles d'échange (lecture seule). Lève une erreur 4xx explicite au premier échec.
 * @param db       client Prisma ou transaction
 * @param opts.checkStock  contrôle qty_available ≥ qty (désactivable quand l'appelant
 *                 contrôle le stock sous verrou)
 * @returns {Promise<{ lines, points_total, points_balance }>}
 */
async function validateExchangeItems(db, { customer_id, node_id, exchange_items, checkStock = true }) {
  const items = normalizeExchangeItems(exchange_items);
  if (!items.length) return { lines: [], points_total: 0, points_balance: null };
  if (!node_id) throw err(400, "Magasin (node) requis pour un échange de points");

  const skuIds = items.map((i) => i.sku_id);
  const [skus, rules, customer] = await Promise.all([
    db.sku.findMany({
      where: { id: { in: skuIds } },
      select: {
        id: true, sku_code: true, name_fr: true, name_ar: true, is_active: true, is_deleted: true, vat_rate: true,
        tax: { select: { rate: true } },
        selling_rules: { where: { node_id }, select: { is_sellable: true } },
        stock_levels: { where: { node_id }, select: { qty_available: true } },
      },
    }),
    db.pointsExchangeSku.findMany({ where: { node_id, sku_id: { in: skuIds }, is_deleted: false } }),
    db.customer.findUnique({ where: { id: customer_id }, select: { id: true, points_balance: true } }),
  ]);
  if (!customer) throw err(404, 'Client introuvable');
  const skuMap = Object.fromEntries(skus.map((s) => [s.id, s]));
  const ruleMap = Object.fromEntries(rules.map((r) => [r.sku_id, r]));

  let points_total = 0;
  const lines = items.map(({ sku_id, qty }) => {
    const sku = skuMap[sku_id];
    if (!sku) throw err(404, 'Produit échangé introuvable');
    const name = sku.name_fr || sku.sku_code;
    const rule = ruleMap[sku_id];
    if (!rule || !rule.is_active) throw err(422, `« ${name} » n'est plus échangeable contre des points sur ce magasin`);
    if (sku.is_deleted || !sku.is_active) throw err(422, `« ${name} » n'est plus disponible`);
    if (!sku.selling_rules[0]?.is_sellable) throw err(422, `« ${name} » n'est pas vendable sur ce magasin`);
    if (rule.max_qty_per_order != null && qty > rule.max_qty_per_order) {
      throw err(422, `« ${name} » : ${rule.max_qty_per_order} unité(s) maximum par commande en échange de points (demandé ${qty})`);
    }
    if (checkStock) {
      const avail = Math.max(0, Number(sku.stock_levels[0]?.qty_available ?? 0));
      if (avail < qty) throw err(409, `Stock insuffisant pour « ${name} » échangé contre des points (disponible ${avail}, demandé ${qty})`);
    }
    const points_spent = rule.points_cost * qty;
    points_total += points_spent;
    return {
      rule_id: rule.id, sku_id, qty, points_cost: rule.points_cost, points_spent,
      name_fr: sku.name_fr, name_ar: sku.name_ar,
      vat_rate: Number(sku.tax?.rate ?? sku.vat_rate ?? 20),
    };
  });

  const balance = Number(customer.points_balance || 0);
  if (points_total > balance) {
    throw err(422, `Solde de points insuffisant : ${balance} point(s) disponible(s), ${points_total} requis pour les produits échangés`);
  }
  return { lines, points_total, points_balance: balance };
}

/** Aperçu non bloquant pour le calcul du panier : { lines, points_total, points_balance, projected_balance, error }. */
async function previewExchange({ customer_id, node_id, exchange_items }) {
  const items = (() => { try { return normalizeExchangeItems(exchange_items); } catch { return null; } })();
  const customer = await prisma.customer.findUnique({ where: { id: customer_id }, select: { points_balance: true } });
  const balance = Number(customer?.points_balance ?? 0);
  if (items && !items.length) return { lines: [], points_total: 0, points_balance: balance, projected_balance: balance, error: null };
  try {
    const r = await validateExchangeItems(prisma, { customer_id, node_id, exchange_items });
    return { ...r, projected_balance: r.points_balance - r.points_total, error: null };
  } catch (e) {
    return { lines: [], points_total: 0, points_balance: balance, projected_balance: balance, error: e?.message || 'Échange de points impossible' };
  }
}

/**
 * GET /customer/points-exchange?node_id= — catalogue « Échanger mes points » du node.
 * Node : paramètre explicite, sinon node déduit du client (dernière commande, adresse…).
 */
async function customerCatalog(customerId, { node_id = null } = {}) {
  const [customer, nodeId] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { points_balance: true } }),
    resolveCustomerNodeId(customerId, { explicitNodeId: node_id }),
  ]);
  const points_balance = Number(customer?.points_balance ?? 0);
  if (!nodeId) return { node: null, points_balance, items: [] };

  const [node, rules] = await Promise.all([
    prisma.node.findUnique({ where: { id: nodeId }, select: { id: true, code: true, name_fr: true, name_ar: true } }),
    prisma.pointsExchangeSku.findMany({
      where: {
        node_id: nodeId, is_active: true, is_deleted: false,
        sku: { is_active: true, is_deleted: false, selling_rules: { some: { node_id: nodeId, is_sellable: true } } },
      },
      orderBy: [{ points_cost: 'asc' }, { created_at: 'asc' }],
      include: {
        sku: {
          select: {
            id: true, sku_code: true, name_fr: true, name_ar: true,
            images: { where: { deleted_at: null }, orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }], take: 1, select: { url: true } },
            stock_levels: { where: { node_id: nodeId }, select: { qty_available: true } },
            selling_rules: { where: { node_id: nodeId }, select: { price: true } },
          },
        },
      },
    }),
  ]);

  const items = rules
    .map((r) => {
      const avail = Math.max(0, Math.floor(Number(r.sku.stock_levels[0]?.qty_available ?? 0)));
      const maxOrderable = r.max_qty_per_order != null ? Math.min(r.max_qty_per_order, avail) : avail;
      const price = r.sku.selling_rules[0]?.price;
      return {
        rule_id: r.id,
        sku_id: r.sku_id,
        sku_code: r.sku.sku_code,
        name_fr: r.sku.name_fr,
        name_ar: r.sku.name_ar,
        image_url: toPublicUrl(r.sku.images[0]?.url) ?? null,
        points_cost: r.points_cost,
        max_qty_per_order: r.max_qty_per_order,
        qty_available: avail,
        max_orderable: maxOrderable,
        price_ttc: price != null && Number(price) > 0 ? round2(price) : null,
        affordable: points_balance >= r.points_cost,
      };
    })
    .filter((i) => i.qty_available > 0);

  return { node, points_balance, items };
}

module.exports = { normalizeExchangeItems, validateExchangeItems, previewExchange, customerCatalog };
