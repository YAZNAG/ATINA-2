// Helpers partagés des écrans Achats & Fournisseurs.

export const errMsg = (err, fallback = 'Une erreur est survenue') =>
  err?.response?.data?.message || err?.message || fallback;

const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf4 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const nfq = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

export const fmtMoney = (v, withUnit = true) =>
  v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '—' : `${nf2.format(Number(v))}${withUnit ? ' MAD' : ''}`;
export const fmtPrice = (v) =>
  v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '—' : `${nf4.format(Number(v))} MAD`;
export const fmtQty = (v) => (v === null || v === undefined || v === '' ? '—' : nfq.format(Number(v)));

export const fmtDate = (d) => {
  if (!d) return '—';
  const s = String(d);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(s);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
};
export const fmtDateTime = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const isoDate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const todayIso = () => isoDate(new Date());
export const addDaysIso = (iso, days) => {
  const d = iso ? new Date(`${iso}T00:00:00`) : new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return isoDate(d);
};

/** Export CSV côté client : séparateur « ; », BOM UTF-8 (lisible par Excel). */
export function downloadCsv(filename, header, rows) {
  const csv = [header, ...rows]
    .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
  const blob = new Blob([String.fromCharCode(0xfeff) + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nombre au format CSV français (virgule décimale). */
export const csvNum = (v) => (v === null || v === undefined || v === '' ? '' : String(v).replace('.', ','));

export const VALIDITY_LABELS = {
  current: { label: 'En vigueur', cls: 'bg-emerald-50 text-emerald-700' },
  future: { label: 'À venir', cls: 'bg-blue-50 text-blue-700' },
  expired: { label: 'Expiré', cls: 'bg-neutral-100 text-neutral-500' },
  inactive: { label: 'Désactivé', cls: 'bg-red-50 text-red-600' },
};

export const SUPPLIER_STATUS = {
  active: { label: 'Actif', cls: 'bg-emerald-50 text-emerald-700' },
  inactive: { label: 'Inactif', cls: 'bg-neutral-100 text-neutral-500' },
  deleted: { label: 'Supprimé', cls: 'bg-red-50 text-red-600' },
};

export const skuLabel = (sku) => (sku ? `${sku.sku_code} — ${sku.name_fr}` : '—');
