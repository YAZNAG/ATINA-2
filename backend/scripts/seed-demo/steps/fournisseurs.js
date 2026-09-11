/**
 * Étape « fournisseurs » : 9 distributeurs fictifs et grille de prix d'achat par SKU
 * (2 paliers de quantité ; prix HT par unité d'achat).
 */
const { SUPPLIERS, suppliersFor } = require('../data/scenario.data');
const { round2, addDays } = require('../lib/util');

/** Coût d'achat HT par unité de VENTE (≈ 72 % du prix HT de vente). */
const unitCost = (s, vatRate) => round2((s.price / (1 + vatRate / 100)) * 0.72);

async function run(ctx) {
  const { prisma } = ctx;
  for (const s of SUPPLIERS) {
    const first = s.contact.split(' ')[0].toLowerCase();
    const last = s.contact.split(' ').slice(1).join('').toLowerCase();
    await ctx.ensure('supplier', { code: s.code }, {
      code: s.code, name_fr: s.name_fr, name_ar: s.name_ar,
      contact_name: s.contact, contact_phone: `+212${s.phone}`, contact_email: `${first}.${last}@example.com`,
      address: s.address, payment_terms: s.terms, lead_time_days: s.lead, score: s.score, is_active: true,
      notes: `Distributeur régional (${s.city}). Données de démonstration.`,
    }, { table: 'suppliers' });
  }
  if (ctx.dry) { ctx.count('supplier_prices', 0); return; }

  const suppliers = await ctx.byCode('supplier');
  const skus = await ctx.skus();
  const taxes = Object.fromEntries((await prisma.tax.findMany()).map((t) => [t.id, Number(t.rate)]));
  const validFrom = addDays(new Date(), -60);
  let n = 0;
  for (const s of skus) {
    const list = suppliersFor(s.sub).slice(0, 2);
    for (const [rank, sup] of list.entries()) {
      const supplier = suppliers[sup.code];
      const perUnit = unitCost(s, taxes[s.row.tax_id] ?? 20) * (rank ? 1.04 : 1); // 2e fournisseur ~4 % plus cher
      const tiers = [[1, 10, 1], [10, null, 0.95]];
      for (const [qmin, qmax, factor] of tiers) {
        const exists = await prisma.supplierPrice.findFirst({ where: { supplier_id: supplier.id, sku_id: s.id, qty_min: qmin } });
        if (exists) continue;
        await prisma.supplierPrice.create({
          data: {
            supplier_id: supplier.id, sku_id: s.id, qty_min: qmin, qty_max: qmax,
            price_ht: Math.round(perUnit * s.coeff * factor * 10000) / 10000,
            valid_from: validFrom, valid_to: null, is_active: true,
          },
        });
        n += 1;
      }
    }
  }
  ctx.count('supplier_prices', n);
  if (n) ctx.log(`${n} prix fournisseurs créés`);
}

module.exports = { name: 'fournisseurs', label: 'Fournisseurs et grilles de prix', run, unitCost };
