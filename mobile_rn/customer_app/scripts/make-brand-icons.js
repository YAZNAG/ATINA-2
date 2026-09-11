/**
 * Génère les icônes et le splash natif de l'app Atina (rouge #E10600, « A. » / « Atina. » en blanc).
 * Usage : node scripts/make-brand-icons.js   (utilise sharp du backend : ../../backend/node_modules)
 */
const path = require('path');
const sharp = require(path.resolve(__dirname, '../../../backend/node_modules/sharp'));

const RED = '#E10600';
const OUT = path.resolve(__dirname, '../assets/images');
const FONT = "font-family=\"Segoe UI, Arial, Helvetica, sans-serif\" font-weight=\"800\"";

const svg = (w, h, body, bg) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
  (bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : '') + body + '</svg>'
);

// Monogramme « A. » centré ; size = hauteur de glyphe approximative
const mono = (w, size, color = '#fff') =>
  `<text x="50%" y="50%" dy="0.35em" text-anchor="middle" ${FONT} font-size="${size}" fill="${color}" letter-spacing="-8">A<tspan fill="${color}">.</tspan></text>`;

// Cercles décoratifs discrets, comme sur le splash de la maquette
const rings = (w) =>
  `<circle cx="${w * 0.95}" cy="${w * 0.05}" r="${w * 0.28}" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="${w * 0.012}"/>` +
  `<circle cx="${w * 0.04}" cy="${w * 0.98}" r="${w * 0.3}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="${w * 0.012}"/>`;

async function main() {
  // Icône principale (iOS / générique)
  await sharp(svg(1024, 1024, rings(1024) + mono(1024, 620), RED)).png().toFile(path.join(OUT, 'icon.png'));
  // Icône adaptative Android : fond rouge + premier plan dans la zone sûre (≈ 66 %)
  await sharp(svg(1024, 1024, '', RED)).png().toFile(path.join(OUT, 'android-icon-background.png'));
  await sharp(svg(1024, 1024, mono(1024, 430))).png().toFile(path.join(OUT, 'android-icon-foreground.png'));
  await sharp(svg(1024, 1024, mono(1024, 430, '#000'))).png().toFile(path.join(OUT, 'android-icon-monochrome.png'));
  // Splash natif : mot « Atina. » blanc sur transparent (fond rouge défini dans app.json)
  await sharp(svg(1200, 400,
    `<text x="50%" y="50%" dy="0.35em" text-anchor="middle" ${FONT} font-size="260" fill="#fff" letter-spacing="-6">Atina.</text>`))
    .png().toFile(path.join(OUT, 'splash-icon.png'));
  // Favicon web
  await sharp(svg(196, 196, mono(196, 130), RED)).png().toFile(path.join(OUT, 'favicon.png'));
  console.log('icônes générées dans', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
