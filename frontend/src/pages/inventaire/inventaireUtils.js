// Utilitaires partagés des écrans Inventaire (niveaux, mouvements, réappro, comptage)

export const N = (v) => Number(v ?? 0);

export const fmtQty = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(n);
};

export const fmtSigned = (v) => {
  const n = N(v);
  return n > 0 ? `+${fmtQty(n)}` : fmtQty(n);
};

export const formatDateTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).replace(',', '');
};

export const formatDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** Export CSV côté client : séparateur « ; », BOM UTF-8 (ouverture directe dans Excel). */
export function downloadCsv(filename, header, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((row) => row.map(esc).join(';')).join('\r\n');
  const blob = new Blob([String.fromCharCode(0xFEFF) + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Extrait un tableau d'une réponse API ({ data: [...] } ou tableau direct). */
export const asList = (res) => {
  const d = res?.data?.data ?? res?.data ?? [];
  return Array.isArray(d) ? d : [];
};

export const apiError = (err, fallback) => err?.response?.data?.message || fallback;

export const todayStamp = () => new Date().toISOString().slice(0, 10);
