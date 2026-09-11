/**
 * Étape « images » : packshots SKU (uploads/skus, comme l'envoi multer du back-office),
 * bannières de catégories (storage/image/categorie/{id}/image.webp), logos de marques
 * (storage/image/marque/{id}/logo.webp), visuels de familles (storage/image/famille/{id}/).
 */
const fs = require('fs');
const path = require('path');
const I = require('../lib/images');
const { FAMILIES, CATEGORIES, BRANDS } = require('../data/catalog.data');

const BACKEND = path.join(__dirname, '..', '..', '..');
const abs = (rel) => path.join(BACKEND, rel.replace(/^\//, ''));

/** Nombre d'images par SKU : 3 pour 10 SKU vitrines, 2 pour 10 autres, 1 sinon. */
const MULTI3 = ['HUI-LES-1L', 'LAI-CEN-DEM', 'EAU-SAL-150', 'THE-SUL-250', 'CSC-DAR-MOY', 'VOL-POU-FER', 'LEG-TOM-1KG', 'FRO-VQR-16', 'COU-PAM-T3', 'SOD-COC-1L'];
const MULTI2 = ['CFT-AIC-FRA', 'JUS-JAO-ORA', 'BEU-PRE-200', 'CAF-NES-200', 'LES-TID-3KG', 'DOU-DOV-GEL', 'FRU-DAT-MED', 'TRA-CHE-500', 'OLV-ATI-VER', 'BIS-MER-CHO'];

async function writeIfMissing(rel, svg, force) {
  const file = abs(rel);
  if (!force && fs.existsSync(file)) return false;
  await I.writeWebp(svg, file);
  return true;
}

async function run(ctx, { force = false } = {}) {
  const { prisma } = ctx;
  const famColor = Object.fromEntries(FAMILIES.map((f) => [f.code, f]));
  const brandMeta = Object.fromEntries(BRANDS.map((b) => [b[0], { name: b[1], color: b[3], style: b[4] }]));
  let files = 0;

  // SKU
  const skus = await ctx.skus();
  for (const s of skus) {
    const fam = famColor[s.sub.split('-')[0]];
    const n = MULTI3.includes(s.code) ? 3 : MULTI2.includes(s.code) ? 2 : 1;
    const hasPrimary = await prisma.skuImage.count({ where: { sku_id: s.id, is_primary: true, deleted_at: null } });
    for (let v = 0; v < n; v += 1) {
      const url = `/uploads/skus/demo-${s.code.toLowerCase()}-${v + 1}.webp`;
      if (ctx.dry) { if (!(await prisma.skuImage.findFirst({ where: { sku_id: s.id, url } }))) ctx.count('sku_images'); continue; }
      const svg = I.packshotSvg({ name: s.name_fr, brand: brandMeta[s.brand].name, size: s.size, color: fam.color, shape: s.shape, variant: v });
      if (await writeIfMissing(url, svg, force)) files += 1;
      await ctx.ensure('skuImage', { sku_id: s.id, url }, {
        sku_id: s.id, url, is_primary: v === 0 && hasPrimary === 0, sort_order: v,
        alt_fr: `${s.name_fr}${v ? ` — vue ${v + 1}` : ''}`, alt_ar: s.name_ar,
      }, { table: 'sku_images' });
    }
  }

  if (ctx.dry) return;

  // Catégories
  const cats = await ctx.byCode('category');
  for (const c of CATEGORIES) {
    const row = cats[c.code];
    if (!row) continue;
    const rel = `/storage/image/categorie/${row.id}/image.webp`;
    if (await writeIfMissing(rel, I.bannerSvg({ title: c.name_fr, subtitle: c.sub, color: c.color, shapes: c.shapes, badge: 'ATINA' }), force)) files += 1;
    if (!row.image_url) await prisma.category.update({ where: { id: row.id }, data: { image_url: rel } });
  }

  // Marques
  const brands = await ctx.byCode('brand');
  for (const [code] of BRANDS) {
    const row = brands[code];
    if (!row) continue;
    const m = brandMeta[code];
    const rel = `/storage/image/marque/${row.id}/logo.webp`;
    if (await writeIfMissing(rel, I.logoSvg({ name: m.name, color: m.color, style: m.style }), force)) files += 1;
    if (!row.logo) await prisma.brand.update({ where: { id: row.id }, data: { logo: rel } });
  }

  // Familles (le modèle sku_families n'a pas de colonne image : fichiers au chemin conventionnel
  // de familyMedia.service.js, storage/image/famille/{id}/image.webp + icon.webp).
  const fams = await ctx.byCode('skuFamily');
  for (const f of FAMILIES) {
    const row = fams[f.code];
    if (!row) continue;
    if (await writeIfMissing(`/storage/image/famille/${row.id}/image.webp`, I.bannerSvg({ title: f.name_fr, subtitle: f.subs.map((s) => s[1]).slice(0, 3).join(' · '), color: f.color, shapes: [f.shape, 'box', 'bottle'], width: 800, height: 600 }), force)) files += 1;
    if (await writeIfMissing(`/storage/image/famille/${row.id}/icon.webp`, I.iconSvg({ letter: f.name_fr.split(' ')[0], color: f.color, shape: f.shape }), force)) files += 1;
  }
  ctx.log(`${files} fichier(s) image écrit(s)`);
  ctx.count('fichiers_images', files);
}

module.exports = { name: 'images', label: 'Images générées (SKU, catégories, marques, familles)', run, BACKEND };
