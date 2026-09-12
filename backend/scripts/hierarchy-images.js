#!/usr/bin/env node
/**
 * US-120 — visuels de la hiérarchie produit.
 *
 * La migration 20260912150000 rend image_url obligatoire sur categories,
 * sku_families et sku_subfamilies. Les lignes qui n'avaient aucune image de
 * produit à reprendre pointent vers « uploads/hierarchy/<type>-<code>.webp » :
 * ce script génère les fichiers manquants (même procédé que le jeu de
 * démonstration : SVG → WebP via sharp, aucune image téléchargée).
 *
 * Idempotent : un fichier déjà présent n'est pas réécrit (sauf --force).
 *
 *   node scripts/hierarchy-images.js [--force] [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const prisma = require('../src/config/database');
const I = require('./seed-demo/lib/images');

const FORCE = process.argv.includes('--force');
const DRY = process.argv.includes('--dry-run');
const ROOT = path.join(__dirname, '..');

// Palette Atina : rouge de marque décliné par type de niveau.
const TONES = {
  categorie: '#E10600',
  famille: '#1F6F52',
  'sous-famille': '#2B5FA8',
};

const slugOf = (url) => String(url || '').split('/').pop();

/** `uploads/hierarchy/famille-BOI.webp` → chemin absolu sur le disque. */
const absOf = (url) => path.join(ROOT, String(url).replace(/^\/+/, ''));

async function generate(kind, rows) {
  let made = 0;
  let kept = 0;
  for (const row of rows) {
    const url = row.image_url || '';
    // On ne touche qu'aux visuels générés : une vraie photo produit est conservée.
    if (!url.startsWith('uploads/hierarchy/')) { kept += 1; continue; }
    const abs = absOf(url);
    if (!FORCE && fs.existsSync(abs)) { kept += 1; continue; }
    if (DRY) { made += 1; continue; }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const svg = I.bannerSvg({
      title: row.name_fr,
      subtitle: row.code,
      color: TONES[kind],
      width: 800,
      height: 600,
    });
    await I.writeWebp(svg, abs);
    made += 1;
    console.log(`  + ${slugOf(url)}  (${row.name_fr})`);
  }
  console.log(`${kind} : ${made} visuel(s) généré(s), ${kept} conservé(s)`);
  return made;
}

async function main() {
  console.log(`Visuels de la hiérarchie produit${DRY ? ' (simulation)' : ''}${FORCE ? ' — régénération forcée' : ''}`);
  const [categories, families, subfamilies] = await Promise.all([
    prisma.category.findMany({ where: { is_deleted: false }, select: { code: true, name_fr: true, image_url: true } }),
    prisma.skuFamily.findMany({ where: { is_deleted: false }, select: { code: true, name_fr: true, image_url: true } }),
    prisma.skuSubFamily.findMany({ where: { is_deleted: false }, select: { code: true, name_fr: true, image_url: true } }),
  ]);
  const total = (await generate('categorie', categories))
    + (await generate('famille', families))
    + (await generate('sous-famille', subfamilies));
  console.log(`Total : ${total} visuel(s).`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
