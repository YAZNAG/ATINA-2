/**
 * Export PDF côté client (jsPDF + jspdf-autotable) — pendant PDF des exports CSV du back-office.
 *
 * Mise en page : titre, sous-titre, filtres appliqués, date de génération, un ou plusieurs
 * tableaux, pied de page « Page X / Y ». Police standard Helvetica (encodage WinAnsi) : les
 * accents français sont conservés ; les caractères hors Latin-1 (espaces fines, tirets longs,
 * ≤, →, arabe…) sont remplacés par un équivalent lisible ou retirés.
 *
 * Usage :
 *   await exportPdf({
 *     title: 'Mouvements de stock',
 *     filters: [['Node', 'DS-01'], ['Période', '01/09 → 10/09']],   // ou { Node: 'DS-01' }
 *     columns: [{ header: 'SKU', key: 'sku' }, { header: 'Qté', value: (r) => r.qty, align: 'right' }],
 *     rows,                                                           // objets (avec columns) ou tableaux
 *     filename: 'mouvements-stock.pdf',
 *   });
 *   // ou plusieurs tableaux : sections: [{ title, headers: [...], rows: [[...]] }, { title, rows: [[k, v]] }]
 *
 * jsPDF est chargé à la demande (import dynamique) : aucun poids ajouté au bundle initial.
 */

const REPLACEMENTS = {
  ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', '​': '',
  '‐': '-', '‑': '-', '‒': '-', '–': '-', '—': '-', '―': '-', '−': '-',
  '‘': "'", '’': "'", '‚': ',', '“': '"', '”': '"', '„': '"',
  '…': '...', '•': '-', '·': '-', '≤': '<=', '≥': '>=', '≠': '!=', '≈': '~',
  '→': '->', '←': '<-', '↔': '<->', '⇒': '=>', '∞': 'infini',
  'œ': 'oe', 'Œ': 'OE', '€': 'EUR', '™': 'TM', '✓': 'oui', '✔': 'oui', '✗': 'non',
};

/** Rend un texte compatible avec les polices standard de jsPDF (Latin-1). */
export function pdfText(value) {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('fr-FR', { maximumFractionDigits: 3 })
    : String(value);
  s = s.replace(/[    ​‐-―−‘-„…•·≠-≥≈←-⇒∞Œœ€™✓✔✗]/g, (c) => REPLACEMENTS[c] ?? c);
  // Tout caractère hors Latin-1 restant (arabe, emoji…) est retiré.
  s = s.replace(/[^\n\x20-\xff]+/g, '');
  return s.replace(/[ \t]{2,}/g, ' ').trim();
}

const fmtNow = () => new Date().toLocaleString('fr-FR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

function normalizeFilters(filters) {
  if (!filters) return [];
  const list = Array.isArray(filters) ? filters : Object.entries(filters);
  return list
    .map((f) => (Array.isArray(f) ? f : [f.label, f.value]))
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '' && v !== false);
}

function cellValue(col, row) {
  if (typeof col.value === 'function') return col.value(row);
  if (col.key !== undefined) return row?.[col.key];
  return '';
}

/**
 * Génère et télécharge un PDF.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.subtitle]
 * @param {Array|object} [opts.filters]  filtres appliqués ([[libellé, valeur]] ou { libellé: valeur })
 * @param {Array} [opts.columns]         [{ header, key | value(row), align?: 'right'|'center', width? }] ou libellés
 * @param {Array} [opts.rows]
 * @param {Array} [opts.sections]        [{ title?, headers?: string[], rows: any[][], align?: {index: 'right'} }]
 * @param {string} [opts.filename]
 * @param {'portrait'|'landscape'} [opts.orientation]  défaut : paysage si > 6 colonnes
 * @param {string} [opts.emptyText]
 */
export async function exportPdf({
  title, subtitle, filters, columns, rows = [], sections, filename, orientation, emptyText = 'Aucune donnée pour les filtres appliqués.',
} = {}) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableMod.default || autoTableMod.autoTable;

  // Normalisation en sections
  let secs = sections;
  if (!secs) {
    const cols = (columns || []).map((c) => (typeof c === 'string' ? { header: c, key: c } : c));
    secs = [{
      headers: cols.map((c) => c.header),
      rows: rows.map((r) => (Array.isArray(r) ? r : cols.map((c) => cellValue(c, r)))),
      align: Object.fromEntries(cols.map((c, i) => [i, c.align]).filter(([, a]) => a)),
    }];
  }
  const maxCols = Math.max(1, ...secs.map((s) => (s.headers ? s.headers.length : 2)));
  const doc = new jsPDF({ orientation: orientation || (maxCols > 6 ? 'landscape' : 'portrait'), unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 12;

  // En-tête
  doc.setFillColor(225, 6, 0);
  doc.rect(0, 0, pageW, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(24, 24, 27);
  doc.text(pdfText(title || 'Export'), M, 13);
  let y = 13;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(113, 113, 122);
  if (subtitle) { y += 5; doc.text(pdfText(subtitle), M, y); }
  y += 5;
  doc.text(pdfText(`Généré le ${fmtNow()}`), M, y);

  const flt = normalizeFilters(filters);
  y += 5;
  doc.setTextColor(63, 63, 70);
  const fltText = flt.length
    ? `Filtres appliqués : ${flt.map(([k, v]) => `${k} : ${v}`).join(' | ')}`
    : 'Filtres appliqués : aucun';
  const wrapped = doc.splitTextToSize(pdfText(fltText), pageW - 2 * M);
  doc.text(wrapped, M, y);
  y += (wrapped.length - 1) * 4 + 4;

  // Tableaux
  secs.forEach((sec, idx) => {
    if (sec.title) {
      if (y > pageH - 30) { doc.addPage(); y = M + 4; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(24, 24, 27);
      doc.text(pdfText(sec.title), M, y + 4);
      y += 6;
    }
    const body = (sec.rows || []).map((r) => (Array.isArray(r) ? r : [r]).map(pdfText));
    const hasHead = Array.isArray(sec.headers) && sec.headers.length > 0;
    const colCount = hasHead ? sec.headers.length : Math.max(1, ...body.map((r) => r.length));
    const columnStyles = {};
    Object.entries(sec.align || {}).forEach(([i, a]) => { columnStyles[i] = { halign: a }; });
    if (!hasHead) columnStyles[0] = { ...(columnStyles[0] || {}), fontStyle: 'bold', cellWidth: 70 };
    autoTable(doc, {
      startY: y + 1,
      margin: { left: M, right: M, bottom: 14 },
      head: hasHead ? [sec.headers.map(pdfText)] : undefined,
      body: body.length ? body : [[{ content: pdfText(sec.emptyText || emptyText), colSpan: colCount, styles: { halign: 'center', textColor: [161, 161, 170], fontStyle: 'italic' } }]],
      theme: hasHead ? 'striped' : 'plain',
      styles: { font: 'helvetica', fontSize: colCount > 9 ? 7 : 8, cellPadding: 1.6, overflow: 'linebreak', textColor: [39, 39, 42] },
      headStyles: { fillColor: [39, 39, 42], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [244, 244, 245] },
      columnStyles,
    });
    y = (doc.lastAutoTable?.finalY ?? y) + (idx < secs.length - 1 ? 6 : 0);
  });

  // Pied de page paginé
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(228, 228, 231);
    doc.line(M, pageH - 10, pageW - M, pageH - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(113, 113, 122);
    doc.text(pdfText(`ATINA — Back-office · ${title || ''}`), M, pageH - 6);
    doc.text(`Page ${i} / ${total}`, pageW - M, pageH - 6, { align: 'right' });
  }

  const name = filename || `${pdfText(title || 'export').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`;
  doc.save(name.endsWith('.pdf') ? name : `${name}.pdf`);
}

/**
 * Convertit les sections d'un export CSV multi-blocs ({ title, headers?, rows }) en PDF :
 * la première section sans en-têtes sert de titre + filtres.
 */
export async function exportSectionsPdf(filename, sections = [], { title, subtitle, orientation } = {}) {
  let secs = [...sections];
  let docTitle = title;
  let filters = [];
  if (secs.length && !secs[0].headers && secs[0].title) {
    docTitle = docTitle || secs[0].title;
    filters = secs[0].rows || [];
    secs = secs.slice(1);
  }
  return exportPdf({
    title: docTitle || 'Export', subtitle, filters, sections: secs, orientation, filename: String(filename || 'export').replace(/\.csv$/i, '.pdf'),
  });
}

export default exportPdf;
