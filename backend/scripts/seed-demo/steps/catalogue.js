/**
 * Étape « catalogue » : familles, sous-familles, catégories plates, marques, SKU
 * (EAN-13 préfixe 611 avec clé de contrôle, noms FR/AR, statut sku_statuses).
 */
const { FAMILIES, CATEGORIES, BRANDS, SKUS, CONSERVATIONS } = require('../data/catalog.data');
const { ean13, round2 } = require('../lib/util');

const UNIT_STR = { PCE: 'unit', KG: 'kg', PACK: 'pack', CART: 'carton', L: 'l', G: 'g', ML: 'ml' };

const FAMILY_BLURB = {
  EPS: ['Indispensable du placard, sélectionné pour la cuisine marocaine du quotidien.', 'من أساسيات المطبخ المغربي اليومي.'],
  EPU: ['Pour le petit-déjeuner, le goûter et le thé à la menthe.', 'للفطور ووقت الشاي واللمجة.'],
  BOI: ['Servir frais. Bouteille recyclable.', 'يُقدَّم باردًا. عبوة قابلة لإعادة التدوير.'],
  LAI: ['Produit frais : à conserver au réfrigérateur entre 0 et 4 °C.', 'منتج طازج: يُحفظ في الثلاجة بين 0 و4 درجات.'],
  FRL: ['Sélectionné chaque matin auprès de producteurs marocains.', 'منتقى كل صباح من فلاحين مغاربة.'],
  BOU: ['Viande halal, découpée et conditionnée le jour même.', 'لحم حلال، مقطع ومعبأ في نفس اليوم.'],
  BLG: ['Cuit chaque jour par nos boulangers partenaires.', 'مخبوز يوميًا لدى مخابز شريكة.'],
  HYG: ['Pour toute la famille, usage quotidien.', 'لكل أفراد الأسرة، للاستعمال اليومي.'],
  ENT: ['Efficace et économique pour l’entretien de la maison.', 'فعال واقتصادي لتنظيف المنزل.'],
  BEB: ['Spécialement conçu pour les tout-petits.', 'مصمم خصيصًا للصغار.'],
};

async function run(ctx) {
  const { prisma } = ctx;
  const now = new Date();

  // Familles & sous-familles
  for (const [i, f] of FAMILIES.entries()) {
    const fam = await ctx.ensure('skuFamily', { code: f.code }, { code: f.code, name_fr: f.name_fr, name_ar: f.name_ar, sort_order: i + 1, is_active: true, updated_at: now }, { table: 'sku_families' });
    for (const [j, [code, fr, ar]] of f.subs.entries()) {
      if (!fam) { ctx.count('sku_subfamilies'); continue; }
      await ctx.ensure('skuSubFamily', { code }, { code, name_fr: fr, name_ar: ar, family_id: fam.id, sort_order: j + 1, is_active: true, updated_at: now }, { table: 'sku_subfamilies' });
    }
  }

  // Catégories plates
  for (const [i, c] of CATEGORIES.entries()) {
    await ctx.ensure('category', { code: c.code }, { code: c.code, name_fr: c.name_fr, name_ar: c.name_ar, gpc_code: c.gpc, sort_order: i + 1, is_active: true, updated_at: now }, { table: 'categories' });
  }

  // Marques
  for (const [code, fr, ar] of BRANDS) {
    await ctx.ensure('brand', { code }, {
      code, name_fr: fr, name_ar: ar, status: 'active',
      description_fr: `Marque ${fr} — produits vendus dans les dark stores ATINA.`,
      description_ar: `علامة ${ar} — منتجات متوفرة في متاجر أتينا.`,
    }, { table: 'brands' });
  }

  if (ctx.dry) { ctx.count('skus', SKUS.length - await prisma.sku.count({ where: { sku_code: { in: SKUS.map((s) => s.code) } } })); return; }

  const [fams, subs, cats, brands, units, taxes, cons, packs, statuses] = await Promise.all([
    ctx.byCode('skuFamily'), ctx.byCode('skuSubFamily'), ctx.byCode('category'), ctx.byCode('brand'),
    ctx.byCode('unit'), ctx.byCode('tax'), ctx.byCode('conservationType'), ctx.byCode('packagingType'), ctx.byCode('skuStatus'),
  ]);
  const brandIdx = Object.fromEntries(BRANDS.map((b, i) => [b[0], i]));
  const consLabel = Object.fromEntries(CONSERVATIONS.map((c) => [c.code, c]));

  for (const [i, s] of SKUS.entries()) {
    const exists = await prisma.sku.findFirst({ where: { sku_code: s.code } });
    if (exists) continue;
    const famCode = s.sub.split('-')[0];
    const tax = taxes[s.tax];
    const rate = Number(tax.rate);
    const brand = brands[s.brand];
    let ean = ean13(`611${String(2000 + brandIdx[s.brand] * 3).padStart(4, '0')}${String(10000 + i * 173).slice(-5)}`);
    if (await prisma.sku.findFirst({ where: { ean13: ean } })) ean = null;
    const [bfr, bar] = FAMILY_BLURB[famCode];
    const c = consLabel[s.cons];
    await prisma.sku.create({
      data: {
        sku_code: s.code, ean13: ean, name_fr: s.name_fr, name_ar: s.name_ar,
        description_fr: `${s.name_fr} de la marque ${brand.name_fr} (${s.size}). ${bfr} Conservation : ${c.name_fr.toLowerCase()}.`,
        description_ar: `${s.name_ar} من علامة ${brand.name_ar}. ${bar} الحفظ: ${c.name_ar}.`,
        brand_id: brand.id, category_id: cats[s.cat].id,
        sku_family_id: fams[famCode].id, sku_subfamily_id: subs[s.sub].id,
        unit_sale: UNIT_STR[s.unit_sale] || 'unit', unit_purchase: UNIT_STR[s.unit_purchase] || 'unit',
        unit_sale_id: units[s.unit_sale].id, unit_purchase_id: units[s.unit_purchase].id, coeff: s.coeff,
        tax_id: tax.id, vat_rate: rate, price: round2(s.price / (1 + rate / 100)),
        weight_g: s.weight_g, volume_ml: s.volume_ml,
        conservation_type_id: cons[s.cons].id, packaging_type_id: packs[s.packaging]?.id ?? null,
        status: s.status, status_id: statuses[s.status]?.id ?? null, is_active: s.status === 'active',
      },
    });
    ctx.count('skus');
  }
}

module.exports = { name: 'catalogue', label: 'Familles, catégories, marques, SKU', run };
