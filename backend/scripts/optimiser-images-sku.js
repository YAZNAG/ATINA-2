#!/usr/bin/env node
/**
 * Allège les photos produit : version WebP 500 px servie à l'app.
 *
 * Les photos ajoutées au catalogue (Figma, Open Food Facts, Wikimedia) font 800 px en
 * JPEG, soit 30 à 120 Ko chacune ; l'accueil en affiche une vingtaine, ce qui ralentit
 * l'ouverture sur mobile. On génère une fois pour toutes un fichier « <nom>-500.webp »
 * et on le déclare comme image principale. Les originaux restent sur le disque.
 *
 *   node scripts/optimiser-images-sku.js [--dry-run] [--width=500] [--quality=78]
 *
 * Idempotent : une image déjà convertie est ignorée.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const prisma = require('../src/config/database');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const WIDTH = Number((args.find((a) => a.startsWith('--width=')) || '--width=500').slice(8));
const QUALITY = Number((args.find((a) => a.startsWith('--quality=')) || '--quality=78').slice(10));
const ROOT = path.join(__dirname, '..');
const PREFIXES = ['figma-', 'off-', 'libre-'];

const isTarget = (url) => /\.(jpe?g|png)$/i.test(url) && PREFIXES.some((p) => path.basename(url).startsWith(p));

async function main() {
  const images = await prisma.skuImage.findMany({
    where: { deleted_at: null },
    select: { id: true, url: true },
  });
  let done = 0;
  let skipped = 0;
  let missing = 0;
  let saved = 0;

  for (const img of images) {
    if (!isTarget(img.url)) { skipped += 1; continue; }
    const rel = img.url.replace(/^\//, '');
    const src = path.join(ROOT, rel);
    const dest = src.replace(/\.(jpe?g|png)$/i, `-${WIDTH}.webp`);
    const destUrl = img.url.replace(/\.(jpe?g|png)$/i, `-${WIDTH}.webp`);
    if (!fs.existsSync(src)) { missing += 1; continue; }

    if (!fs.existsSync(dest)) {
      if (DRY) { done += 1; continue; }
      await sharp(src).resize(WIDTH, WIDTH, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY }).toFile(dest);
    }
    const before = fs.statSync(src).size;
    const after = fs.existsSync(dest) ? fs.statSync(dest).size : before;
    saved += before - after;
    if (!DRY) {
      await prisma.skuImage.update({ where: { id: img.id }, data: { url: destUrl, updated_at: new Date() } });
    }
    done += 1;
    console.log(`${path.basename(destUrl).padEnd(38)} ${(before / 1024).toFixed(0)} Ko -> ${(after / 1024).toFixed(0)} Ko`);
  }
  console.log(`${done} image(s) ${DRY ? 'à convertir' : 'converties'}, ${skipped} déjà légères, ${missing} fichier(s) absent(s).`);
  console.log(`Économie totale : ${(saved / 1024 / 1024).toFixed(1)} Mo`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
