/**
 * Génération d'images de démonstration (SVG → WebP via sharp). Aucune image
 * téléchargée, aucun logo réel reproduit : formes simples + texte.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const FONT = 'DejaVu Sans, Verdana, Arial, Helvetica, sans-serif';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function shade(hex, pct) {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 255; let g = (n >> 8) & 255; let b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(pct >= 0 ? c + (255 - c) * pct : c * (1 + pct))));
  r = f(r); g = f(g); b = f(b);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Découpe un texte en lignes de ~max caractères. */
function wrap(text, max = 20, maxLines = 3) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((`${cur} ${w}`).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (`${cur} ${w}`).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
    return kept;
  }
  return lines;
}

/** Forme d'emballage centrée en (cx, cy), hauteur h. */
function shapeSvg(shape, cx, cy, h, color, label = '') {
  const dark = shade(color, -0.35);
  const light = shade(color, 0.55);
  const lbl = esc(label).slice(0, 14);
  const labelText = (y, size = h * 0.075, fill = dark) => (lbl
    ? `<text x="${cx}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="bold" fill="${fill}" text-anchor="middle">${lbl}</text>` : '');
  switch (shape) {
    case 'bottle': {
      const bw = h * 0.36;
      return `<g><rect x="${cx - bw * 0.18}" y="${cy - h / 2}" width="${bw * 0.36}" height="${h * 0.1}" rx="6" fill="${dark}"/>
        <path d="M${cx - bw * 0.2} ${cy - h * 0.4} L${cx + bw * 0.2} ${cy - h * 0.4} L${cx + bw / 2} ${cy - h * 0.22} L${cx + bw / 2} ${cy + h / 2 - 12} Q${cx + bw / 2} ${cy + h / 2} ${cx + bw / 2 - 12} ${cy + h / 2} L${cx - bw / 2 + 12} ${cy + h / 2} Q${cx - bw / 2} ${cy + h / 2} ${cx - bw / 2} ${cy + h / 2 - 12} L${cx - bw / 2} ${cy - h * 0.22} Z" fill="${light}" stroke="${dark}" stroke-width="5"/>
        <rect x="${cx - bw / 2}" y="${cy - h * 0.02}" width="${bw}" height="${h * 0.26}" fill="${color}"/>
        <rect x="${cx - bw * 0.36}" y="${cy - h * 0.3}" width="${bw * 0.1}" height="${h * 0.6}" rx="5" fill="#ffffff" opacity="0.35"/>
        ${labelText(cy + h * 0.14, h * 0.06, '#ffffff')}</g>`;
    }
    case 'jug': {
      const bw = h * 0.62;
      return `<g><rect x="${cx - bw * 0.1}" y="${cy - h / 2}" width="${bw * 0.2}" height="${h * 0.1}" rx="6" fill="${dark}"/>
        <path d="M${cx - bw / 2} ${cy - h * 0.3} Q${cx - bw / 2} ${cy - h * 0.42} ${cx - bw * 0.3} ${cy - h * 0.42} L${cx + bw * 0.3} ${cy - h * 0.42} Q${cx + bw / 2} ${cy - h * 0.42} ${cx + bw / 2} ${cy - h * 0.3} L${cx + bw / 2} ${cy + h / 2 - 14} Q${cx + bw / 2} ${cy + h / 2} ${cx + bw / 2 - 14} ${cy + h / 2} L${cx - bw / 2 + 14} ${cy + h / 2} Q${cx - bw / 2} ${cy + h / 2} ${cx - bw / 2} ${cy + h / 2 - 14} Z" fill="${light}" stroke="${dark}" stroke-width="5"/>
        <rect x="${cx + bw * 0.12}" y="${cy - h * 0.36}" width="${bw * 0.3}" height="${h * 0.18}" rx="14" fill="none" stroke="${dark}" stroke-width="8"/>
        <rect x="${cx - bw / 2}" y="${cy}" width="${bw}" height="${h * 0.25}" fill="${color}"/>
        ${labelText(cy + h * 0.15, h * 0.08, '#ffffff')}</g>`;
    }
    case 'brick': {
      const bw = h * 0.5;
      return `<g><path d="M${cx - bw / 2} ${cy - h * 0.38} L${cx} ${cy - h / 2} L${cx + bw / 2} ${cy - h * 0.38} Z" fill="${dark}"/>
        <rect x="${cx + bw * 0.12}" y="${cy - h * 0.5}" width="${bw * 0.14}" height="${h * 0.08}" rx="4" fill="${color}"/>
        <rect x="${cx - bw / 2}" y="${cy - h * 0.38}" width="${bw}" height="${h * 0.88}" rx="8" fill="#ffffff" stroke="${dark}" stroke-width="5"/>
        <rect x="${cx - bw / 2}" y="${cy + h * 0.05}" width="${bw}" height="${h * 0.3}" fill="${color}"/>
        <circle cx="${cx}" cy="${cy - h * 0.12}" r="${h * 0.12}" fill="${light}"/>
        ${labelText(cy + h * 0.22, h * 0.065, '#ffffff')}</g>`;
    }
    case 'jar': {
      const bw = h * 0.6;
      return `<g><rect x="${cx - bw * 0.46}" y="${cy - h / 2}" width="${bw * 0.92}" height="${h * 0.16}" rx="10" fill="${dark}"/>
        <rect x="${cx - bw / 2}" y="${cy - h * 0.34}" width="${bw}" height="${h * 0.84}" rx="${h * 0.1}" fill="${light}" stroke="${dark}" stroke-width="5"/>
        <rect x="${cx - bw / 2}" y="${cy - h * 0.1}" width="${bw}" height="${h * 0.34}" fill="#ffffff"/>
        <rect x="${cx - bw / 2}" y="${cy - h * 0.1}" width="${bw}" height="${h * 0.06}" fill="${color}"/>
        ${labelText(cy + h * 0.12, h * 0.075)}</g>`;
    }
    case 'can': {
      const bw = h * 0.5;
      return `<g><ellipse cx="${cx}" cy="${cy - h * 0.42}" rx="${bw / 2}" ry="${h * 0.07}" fill="${shade(color, -0.1)}" stroke="${dark}" stroke-width="4"/>
        <rect x="${cx - bw / 2}" y="${cy - h * 0.42}" width="${bw}" height="${h * 0.84}" fill="${color}"/>
        <ellipse cx="${cx}" cy="${cy + h * 0.42}" rx="${bw / 2}" ry="${h * 0.07}" fill="${dark}"/>
        <rect x="${cx - bw / 2}" y="${cy - h * 0.14}" width="${bw}" height="${h * 0.3}" fill="#ffffff"/>
        <rect x="${cx - bw * 0.36}" y="${cy - h * 0.38}" width="${bw * 0.1}" height="${h * 0.76}" fill="#ffffff" opacity="0.3"/>
        ${labelText(cy + h * 0.04, h * 0.07)}</g>`;
    }
    case 'bag':
    case 'sachet': {
      const bw = shape === 'bag' ? h * 0.66 : h * 0.54;
      return `<g><path d="M${cx - bw / 2} ${cy - h * 0.4} L${cx + bw / 2} ${cy - h * 0.4} L${cx + bw / 2 + 10} ${cy + h / 2} L${cx - bw / 2 - 10} ${cy + h / 2} Z" fill="${color}" stroke="${dark}" stroke-width="5"/>
        <path d="M${cx - bw / 2} ${cy - h * 0.4} L${cx - bw / 2 + 16} ${cy - h / 2} L${cx + bw / 2 - 16} ${cy - h / 2} L${cx + bw / 2} ${cy - h * 0.4} Z" fill="${dark}"/>
        <rect x="${cx - bw * 0.38}" y="${cy - h * 0.18}" width="${bw * 0.76}" height="${h * 0.42}" rx="16" fill="#ffffff"/>
        <circle cx="${cx}" cy="${cy - h * 0.02}" r="${h * 0.08}" fill="${light}"/>
        ${labelText(cy + h * 0.17, h * 0.065)}</g>`;
    }
    case 'box': {
      const bw = h * 0.72;
      return `<g><path d="M${cx - bw / 2} ${cy - h * 0.34} L${cx - bw / 2 + 30} ${cy - h / 2} L${cx + bw / 2 + 30} ${cy - h / 2} L${cx + bw / 2} ${cy - h * 0.34} Z" fill="${light}" stroke="${dark}" stroke-width="4"/>
        <path d="M${cx + bw / 2} ${cy - h * 0.34} L${cx + bw / 2 + 30} ${cy - h / 2} L${cx + bw / 2 + 30} ${cy + h * 0.34} L${cx + bw / 2} ${cy + h / 2} Z" fill="${dark}"/>
        <rect x="${cx - bw / 2}" y="${cy - h * 0.34}" width="${bw}" height="${h * 0.84}" fill="${color}" stroke="${dark}" stroke-width="4"/>
        <rect x="${cx - bw * 0.4}" y="${cy - h * 0.12}" width="${bw * 0.8}" height="${h * 0.36}" rx="14" fill="#ffffff"/>
        ${labelText(cy + h * 0.09, h * 0.075)}</g>`;
    }
    case 'tube': {
      const bw = h * 0.3;
      return `<g transform="rotate(-18 ${cx} ${cy})"><rect x="${cx - bw * 0.3}" y="${cy - h / 2}" width="${bw * 0.6}" height="${h * 0.12}" rx="6" fill="${dark}"/>
        <path d="M${cx - bw / 2} ${cy - h * 0.38} L${cx + bw / 2} ${cy - h * 0.38} L${cx + bw * 0.62} ${cy + h * 0.46} L${cx - bw * 0.62} ${cy + h * 0.46} Z" fill="#ffffff" stroke="${dark}" stroke-width="5"/>
        <rect x="${cx - bw * 0.62}" y="${cy + h * 0.42}" width="${bw * 1.24}" height="${h * 0.06}" fill="${dark}"/>
        <rect x="${cx - bw / 2}" y="${cy - h * 0.1}" width="${bw}" height="${h * 0.24}" fill="${color}"/></g>`;
    }
    case 'fruit': {
      const r = h * 0.3;
      return `<g><circle cx="${cx - r * 0.7}" cy="${cy + r * 0.35}" r="${r}" fill="${color}" stroke="${dark}" stroke-width="4"/>
        <circle cx="${cx + r * 0.75}" cy="${cy + r * 0.45}" r="${r * 0.9}" fill="${shade(color, -0.12)}" stroke="${dark}" stroke-width="4"/>
        <circle cx="${cx + r * 0.05}" cy="${cy - r * 0.45}" r="${r * 0.95}" fill="${shade(color, 0.12)}" stroke="${dark}" stroke-width="4"/>
        <path d="M${cx} ${cy - r * 1.35} q${r * 0.5} ${-r * 0.5} ${r * 0.9} ${-r * 0.1} q${-r * 0.5} ${r * 0.35} ${-r * 0.9} ${r * 0.1}" fill="#3e8e41"/>
        <circle cx="${cx - r * 0.15}" cy="${cy - r * 0.75}" r="${r * 0.22}" fill="#ffffff" opacity="0.35"/></g>`;
    }
    case 'bunch': {
      const leaves = [];
      for (let i = 0; i < 9; i += 1) {
        const a = -70 + i * 17.5;
        leaves.push(`<ellipse cx="${cx}" cy="${cy - h * 0.2}" rx="${h * 0.07}" ry="${h * 0.2}" fill="${shade(color, (i % 3) * 0.1)}" transform="rotate(${a} ${cx} ${cy + h * 0.2})"/>`);
      }
      return `<g>${leaves.join('')}<rect x="${cx - h * 0.06}" y="${cy + h * 0.1}" width="${h * 0.12}" height="${h * 0.4}" rx="8" fill="#5d7c34"/>
        <rect x="${cx - h * 0.1}" y="${cy + h * 0.22}" width="${h * 0.2}" height="${h * 0.06}" rx="4" fill="#c0392b"/></g>`;
    }
    case 'tray': {
      const bw = h * 0.95;
      return `<g><path d="M${cx - bw / 2} ${cy - h * 0.12} L${cx + bw / 2} ${cy - h * 0.12} L${cx + bw * 0.42} ${cy + h * 0.3} L${cx - bw * 0.42} ${cy + h * 0.3} Z" fill="#ffffff" stroke="${dark}" stroke-width="5"/>
        <ellipse cx="${cx}" cy="${cy - h * 0.05}" rx="${bw * 0.36}" ry="${h * 0.18}" fill="${color}"/>
        <ellipse cx="${cx - bw * 0.1}" cy="${cy - h * 0.1}" rx="${bw * 0.12}" ry="${h * 0.06}" fill="${light}" opacity="0.7"/>
        <rect x="${cx - bw * 0.3}" y="${cy + h * 0.12}" width="${bw * 0.6}" height="${h * 0.12}" rx="8" fill="${dark}"/>
        ${labelText(cy + h * 0.21, h * 0.06, '#ffffff')}</g>`;
    }
    case 'carton': {
      const bw = h * 0.95;
      const eggs = [];
      for (let i = 0; i < 5; i += 1) eggs.push(`<ellipse cx="${cx - bw * 0.36 + i * bw * 0.18}" cy="${cy - h * 0.1}" rx="${bw * 0.075}" ry="${h * 0.12}" fill="#f5e6c8" stroke="#c9a66b" stroke-width="3"/>`);
      return `<g>${eggs.join('')}<path d="M${cx - bw / 2} ${cy - h * 0.02} L${cx + bw / 2} ${cy - h * 0.02} L${cx + bw * 0.44} ${cy + h * 0.28} L${cx - bw * 0.44} ${cy + h * 0.28} Z" fill="${color}" stroke="${dark}" stroke-width="5"/>
        ${labelText(cy + h * 0.17, h * 0.075, '#ffffff')}</g>`;
    }
    case 'loaf': {
      const bw = h * 0.95;
      return `<g><ellipse cx="${cx}" cy="${cy}" rx="${bw / 2}" ry="${h * 0.28}" fill="${color}" stroke="${dark}" stroke-width="5"/>
        <path d="M${cx - bw * 0.25} ${cy - h * 0.2} q${bw * 0.05} ${h * 0.15} 0 ${h * 0.3} M${cx} ${cy - h * 0.24} q${bw * 0.05} ${h * 0.17} 0 ${h * 0.36} M${cx + bw * 0.25} ${cy - h * 0.2} q${bw * 0.05} ${h * 0.15} 0 ${h * 0.3}" stroke="${light}" stroke-width="8" fill="none"/></g>`;
    }
    case 'pack': {
      const parts = [-1, 0, 1].map((i) => shapeSvg('bottle', cx + i * h * 0.26, cy + h * 0.06, h * 0.78, color, ''));
      return `<g>${parts.join('')}<rect x="${cx - h * 0.46}" y="${cy + h * 0.05}" width="${h * 0.92}" height="${h * 0.18}" rx="10" fill="${dark}" opacity="0.85"/>
        ${labelText(cy + h * 0.17, h * 0.075, '#ffffff')}</g>`;
    }
    default:
      return shapeSvg('box', cx, cy, h, color, label);
  }
}

/** Packshot produit 800×800. variant 0 = face, 1 = infos produit, 2 = mise en situation. */
function packshotSvg({ name, brand, size, color, shape, variant = 0, shortLabel }) {
  const W = 800;
  const lines = wrap(name, 24, 3);
  const bg1 = shade(color, variant === 2 ? 0.25 : 0.82);
  const bg2 = shade(color, variant === 2 ? -0.05 : 0.55);
  const deco = variant === 2
    ? Array.from({ length: 14 }, (_, i) => `<circle cx="${(i * 137) % W}" cy="${(i * 89) % 520}" r="${18 + (i % 4) * 10}" fill="#ffffff" opacity="0.14"/>`).join('')
    : `<circle cx="${W / 2}" cy="330" r="250" fill="#ffffff" opacity="0.55"/>`;
  const info = variant === 1
    ? `<g><rect x="470" y="150" width="280" height="250" rx="18" fill="#ffffff" opacity="0.92"/>
       <text x="490" y="195" font-family="${FONT}" font-size="24" font-weight="bold" fill="${shade(color, -0.45)}">Infos produit</text>
       ${['Qualité contrôlée', 'Stockage adapté', 'Origine : Maroc', `Format : ${size || '-'}`].map((t, i) => `<text x="490" y="${240 + i * 38}" font-family="${FONT}" font-size="20" fill="#333333">• ${esc(t)}</text>`).join('')}</g>`
    : '';
  const cx = variant === 1 ? 260 : W / 2;
  const nameSize = lines.length > 2 ? 31 : 34;
  const nameY = lines.length > 2 ? 680 : 696;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
  <rect width="${W}" height="${W}" fill="url(#g)"/>${deco}
  <ellipse cx="${cx}" cy="560" rx="200" ry="22" fill="#000000" opacity="0.10"/>
  ${shapeSvg(shape, cx, 340, 420, color, shortLabel || brand)}
  ${info}
  <rect x="0" y="600" width="${W}" height="200" fill="#ffffff" opacity="0.93"/>
  <text x="40" y="${lines.length > 2 ? 640 : 652}" font-family="${FONT}" font-size="24" font-weight="bold" fill="${shade(color, -0.45)}" letter-spacing="2">${esc(String(brand).toUpperCase())}</text>
  ${lines.map((l, i) => `<text x="40" y="${nameY + i * 38}" font-family="${FONT}" font-size="${nameSize}" font-weight="bold" fill="#1f2933">${esc(l)}</text>`).join('')}
  ${size ? `<rect x="${W - 190}" y="620" width="160" height="56" rx="28" fill="${color}"/><text x="${W - 110}" y="658" font-family="${FONT}" font-size="26" font-weight="bold" fill="#ffffff" text-anchor="middle">${esc(size)}</text>` : ''}
</svg>`;
}

function bannerSvg({ title, subtitle, color, width = 1200, height = 400, shapes = [], badge }) {
  const dark = shade(color, -0.35);
  const lines = wrap(title, 26, 2);
  const icons = shapes.slice(0, 3).map((s, i) => shapeSvg(s, width - 420 + i * 150, height / 2 + 20, height * 0.55, shade(color, 0.15 * (i + 1)), '')).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>
  <rect width="${width}" height="${height}" fill="url(#b)"/>
  ${Array.from({ length: 10 }, (_, i) => `<circle cx="${(i * 173) % width}" cy="${(i * 97) % height}" r="${30 + (i % 3) * 25}" fill="#ffffff" opacity="0.07"/>`).join('')}
  <g opacity="0.95">${icons}</g>
  ${badge ? `<rect x="60" y="${height * 0.14}" width="${badge.length * 16 + 44}" height="48" rx="24" fill="#ffffff"/><text x="82" y="${height * 0.14 + 33}" font-family="${FONT}" font-size="24" font-weight="bold" fill="${dark}">${esc(badge)}</text>` : ''}
  ${lines.map((l, i) => `<text x="60" y="${height * 0.5 + i * 62}" font-family="${FONT}" font-size="54" font-weight="bold" fill="#ffffff">${esc(l)}</text>`).join('')}
  ${subtitle ? `<text x="60" y="${height * 0.5 + lines.length * 62 + 10}" font-family="${FONT}" font-size="26" fill="#ffffff" opacity="0.92">${esc(subtitle)}</text>` : ''}
</svg>`;
}

function logoSvg({ name, color, style = 0 }) {
  const W = 600; const H = 300;
  const dark = shade(color, -0.3);
  const lines = wrap(name, 14, 2);
  const size = lines.length > 1 ? 52 : (name.length > 10 ? 60 : 76);
  const frame = [
    `<rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="40" fill="${color}"/>`,
    `<ellipse cx="${W / 2}" cy="${H / 2}" rx="${W / 2 - 24}" ry="${H / 2 - 24}" fill="${color}" stroke="${dark}" stroke-width="8"/>`,
    `<rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="#ffffff" stroke="${color}" stroke-width="12"/>`,
  ][style % 3];
  const fill = style % 3 === 2 ? color : '#ffffff';
  const y0 = H / 2 + size / 3 - (lines.length - 1) * size * 0.55;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>${frame}
  ${lines.map((l, i) => `<text x="${W / 2}" y="${y0 + i * size * 1.1}" font-family="${FONT}" font-size="${size}" font-weight="bold" font-style="${style % 2 ? 'italic' : 'normal'}" fill="${fill}" text-anchor="middle">${esc(l)}</text>`).join('')}
</svg>`;
}

function iconSvg({ letter, color, shape }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="56" fill="${color}"/>
  ${shape ? shapeSvg(shape, 128, 118, 140, shade(color, 0.35), '') : ''}
  ${letter ? `<text x="128" y="236" font-family="${FONT}" font-size="26" font-weight="bold" fill="#ffffff" text-anchor="middle">${esc(letter)}</text>` : ''}
</svg>`;
}

async function writeWebp(svg, absPath, { quality = 82 } = {}) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  await sharp(Buffer.from(svg)).webp({ quality }).toFile(absPath);
  return absPath;
}

module.exports = { packshotSvg, bannerSvg, logoSvg, iconSvg, writeWebp, shade, esc, wrap };
