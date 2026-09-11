/**
 * Étape « vente » : règles de vente par node (prix TTC, vendabilité, vente en rupture),
 * règles de réappro (stock de sécurité, point de commande, quantité économique,
 * fournisseur préféré, FIFO / CUMP) et seuils d'alerte.
 */
const { PRICE_FACTOR, NOT_SELLABLE, BACKORDER, LOW, SUPPLIERS, suppliersFor } = require('../data/scenario.data');
const { round50, seedOf, rng } = require('../lib/util');

const FIFO_FAMILIES = ['LAI', 'FRL', 'BOU', 'BLG'];

async function run(ctx) {
  const { prisma } = ctx;
  const [nodes, skus] = await Promise.all([ctx.nodes(), ctx.skus()]);
  const active = skus.filter((s) => s.status === 'active');
  if (ctx.dry) { ctx.count('selling_rules', nodes.length * active.length); return; }
  const [costing, suppliers] = await Promise.all([ctx.byCode('costingMethod'), ctx.byCode('supplier')]);

  for (const node of nodes) {
    const r = rng(seedOf(`vente-${node.code}`));
    const notSellable = NOT_SELLABLE[node.code] || [];
    const backorder = Object.fromEntries((BACKORDER[node.code] || []).map(([c, lim, days]) => [c, { lim, days }]));
    const low = LOW[node.code] || [];
    for (const s of active) {
      const bo = backorder[s.code];
      const price = Math.max(0.5, round50(s.price * PRICE_FACTOR[node.code]));
      const exists = await prisma.sellingRule.findUnique({ where: { node_id_sku_id: { node_id: node.id, sku_id: s.id } } });
      if (!exists) {
        await prisma.sellingRule.create({
          data: {
            node_id: node.id, sku_id: s.id, price, is_sellable: !notSellable.includes(s.code),
            is_backorderable: !!bo, backorder_limit: bo ? bo.lim : 0, estimated_restock_days: bo ? bo.days : 1,
          },
        });
        ctx.count('selling_rules');
      }

      // Réappro sur ~65 % des couples (+ tous les SKU volontairement bas / en rupture autorisée)
      const withRule = low.includes(s.code) || !!bo || r() < 0.65;
      if (!withRule) continue;
      const fam = s.sub.split('-')[0];
      const sup = suppliersFor(s.sub)[0];
      const eoq = s.coeff > 1 ? s.coeff * 3 : 20;
      const data = {
        node_id: node.id, sku_id: s.id,
        safety_stock: s.coeff > 1 ? Math.max(4, Math.round(s.coeff / 2)) : 5,
        reorder_point: s.coeff > 1 ? s.coeff * (low.includes(s.code) ? 2 : 1) : 10,
        economic_qty: eoq, max_stock: eoq * 3, lead_time_days: SUPPLIERS.find((x) => x.code === sup.code).lead,
        costing_method_id: costing[FIFO_FAMILIES.includes(fam) ? 'FIFO' : 'CUMP'].id,
        preferred_supplier_id: suppliers[sup.code]?.id ?? null, is_active: true,
      };
      if (!(await prisma.reorderRule.findUnique({ where: { node_id_sku_id: { node_id: node.id, sku_id: s.id } } }))) {
        await prisma.reorderRule.create({ data });
        ctx.count('reorder_rules');
      }
      if (!(await prisma.stockThresholdRule.findUnique({ where: { node_id_sku_id: { node_id: node.id, sku_id: s.id } } }))) {
        await prisma.stockThresholdRule.create({
          data: {
            node_id: node.id, sku_id: s.id, stock_minimum: data.safety_stock, stock_alert_threshold: data.reorder_point,
            stock_maximum: data.max_stock, reorder_quantity: data.economic_qty, auto_restock_enabled: false, is_active: true,
          },
        });
        ctx.count('stock_threshold_rules');
      }
    }
  }
}

module.exports = { name: 'vente', label: 'Règles de vente, de réappro et seuils', run };
