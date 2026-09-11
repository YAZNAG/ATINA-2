/**
 * Étape « referentiels » : unités, taxes, conservation, conditionnements, zones,
 * niveaux de rayonnage, types de nodes, contrôle des référentiels système.
 */
const { UNITS, TAXES, CONSERVATIONS, PACKAGINGS } = require('../data/catalog.data');
const { NODE_TYPES } = require('../data/people.data');

const ZONES = [
  { code: 'AMB', name_fr: 'Ambiant', name_ar: 'منطقة درجة حرارة الغرفة', description_fr: 'Épicerie, boissons, hygiène, entretien' },
  { code: 'FRAIS', name_fr: 'Frais', name_ar: 'منطقة التبريد', description_fr: 'Chambre froide positive 0–4 °C' },
  { code: 'SURG', name_fr: 'Surgelé', name_ar: 'منطقة التجميد', description_fr: 'Congélateurs −18 °C' },
  { code: 'RES', name_fr: 'Réserve', name_ar: 'المخزن الاحتياطي', description_fr: 'Surstock et palettes' },
];
const LEVELS = [
  { code: 'N0', name_fr: 'Sol', name_ar: 'الأرضية', sort_order: 0 },
  { code: 'N1', name_fr: 'Niveau 1', name_ar: 'المستوى 1', sort_order: 1 },
  { code: 'N2', name_fr: 'Niveau 2', name_ar: 'المستوى 2', sort_order: 2 },
  { code: 'N3', name_fr: 'Niveau 3', name_ar: 'المستوى 3', sort_order: 3 },
];

/** Référentiels système attendus (seed_p0_reference_data.sql) : complétés s'ils manquent. */
const SYSTEM = {
  costingMethod: [['FIFO', 'Premier entré, premier sorti', 'الوارد أولاً يصرف أولاً'], ['CUMP', 'Coût unitaire moyen pondéré', 'التكلفة المتوسطة المرجحة']],
  deliveryType: [['home', 'Livraison à domicile', 'التوصيل إلى المنزل'], ['pickup', 'Retrait en magasin', 'الاستلام من المتجر']],
  skuStatus: [['draft', 'Brouillon', 'مسودة'], ['active', 'Actif', 'نشط'], ['inactive', 'Inactif', 'غير نشط'], ['discontinued', 'Arrêté', 'متوقف']],
};

async function run(ctx) {
  const { prisma } = ctx;
  for (const u of UNITS) await ctx.ensure('unit', { code: u.code }, { ...u, status: 'active' }, { table: 'units' });
  for (const t of TAXES) await ctx.ensure('tax', { code: t.code }, { ...t, status: 'active' }, { table: 'taxes' });
  for (const c of CONSERVATIONS) await ctx.ensure('conservationType', { code: c.code }, { ...c, status: 'active' }, { table: 'conservation_types' });
  const units = await ctx.byCode('unit');
  for (const p of PACKAGINGS) {
    const { unit, ...rest } = p;
    await ctx.ensure('packagingType', { code: p.code }, { ...rest, unit_id: units[unit]?.id ?? null, status: 'active' }, { table: 'packaging_types' });
  }
  for (const z of ZONES) await ctx.ensure('zone', { code: z.code }, { ...z, description_ar: z.name_ar }, { table: 'zones' });
  for (const l of LEVELS) await ctx.ensure('level', { code: l.code }, l, { table: 'levels' });
  for (const t of NODE_TYPES) await ctx.ensure('nodeType', { code: t.code }, t, { table: 'node_types' });

  for (const [code, fr, ar] of SYSTEM.costingMethod) await ctx.ensure('costingMethod', { code }, { code, name_fr: fr, name_ar: ar }, { table: 'costing_methods' });
  for (const [code, fr, ar] of SYSTEM.deliveryType) await ctx.ensure('deliveryType', { code }, { code, name_fr: fr, name_ar: ar }, { table: 'delivery_types' });
  for (const [i, [code, fr, ar]] of SYSTEM.skuStatus.entries()) await ctx.ensure('skuStatus', { code }, { code, name_fr: fr, name_ar: ar, sort_order: i + 1 }, { table: 'sku_statuses' });

  // Contrôle des référentiels indispensables aux flux (créés par les migrations / seed P0).
  const checks = {
    orderStatus: ['pending', 'confirmed', 'picking', 'ready', 'in_delivery', 'delivered', 'cancelled', 'awaiting_stock'],
    orderItemStatus: ['active', 'cancelled', 'substituted'],
    pickingStatus: ['open', 'in_progress', 'completed', 'cancelled'],
    pickItemStatus: ['pending', 'picked'],
    paymentStatus: ['pending', 'collected'],
    paymentMethod: ['cod'],
    tourStatus: ['planned', 'in_progress', 'completed'],
    stopStatus: ['pending', 'delivered', 'failed'],
    moveType: ['reception', 'sale', 'adjustment_in', 'adjustment_out'],
    poStatus: ['draft', 'sent', 'in_transit', 'partially_received', 'received', 'cancelled'],
    points_txn: null,
  };
  for (const [model, codes] of Object.entries(checks)) {
    if (!codes) continue;
    const found = new Set((await prisma[model].findMany({ select: { code: true } })).map((r) => r.code));
    const missing = codes.filter((c) => !found.has(c));
    if (missing.length) ctx.warn(`${model} : codes absents ${missing.join(', ')} — lancez prisma/seed_p0_reference_data.sql`);
  }
}

module.exports = { name: 'referentiels', label: 'Référentiels (unités, taxes, zones…)', run };
