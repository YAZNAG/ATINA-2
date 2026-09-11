// Utilitaires partagés : Préparation (Picking), Contrôles Qualité, Staff.

export const sessionRef = (id) => 'PSK-' + String(id ?? '').slice(0, 8).toUpperCase();
export const orderRef   = (id) => (id ? 'ORD-' + String(id).slice(0, 8).toUpperCase() : '—');

export const fmtDateTime = (d) => {
  if (!d) return '—';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
  return x.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const fmtMinutes = (m) => {
  if (m === null || m === undefined) return '—';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
};

export const fmtQty = (q) => {
  const n = Number(q ?? 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
};

export const locationLabel = (loc) => {
  if (!loc) return '';
  const parts = [];
  if (loc.label) parts.push(loc.label);
  const detail = [loc.zone?.name_fr, loc.aisle && `Allée ${loc.aisle}`, loc.shelf && `Étagère ${loc.shelf}`, loc.level?.name_fr].filter(Boolean).join(' · ');
  if (detail) parts.push(`(${detail})`);
  return parts.join(' ');
};

export const SESSION_STATUS_STYLE = {
  open:        'bg-slate-100 text-slate-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed:   'bg-emerald-100 text-emerald-700',
  cancelled:   'bg-rose-100 text-rose-700',
};

export const ITEM_STATUS_STYLE = {
  pending:      'bg-slate-100 text-slate-600',
  picked:       'bg-emerald-100 text-emerald-700',
  substituted:  'bg-blue-100 text-blue-700',
  out_of_stock: 'bg-rose-100 text-rose-700',
  missing:      'bg-rose-100 text-rose-700',
};

export const SESSION_STATUSES = [
  { code: 'open',        label: 'Ouverte' },
  { code: 'in_progress', label: 'En cours' },
  { code: 'completed',   label: 'Terminée' },
  { code: 'cancelled',   label: 'Annulée' },
];

/** Performance d'une session clôturée : libellé et classe de couleur. */
export const performanceOf = (m) => {
  if (!m) return { label: '—', cls: 'text-slate-400' };
  const acc = m.accuracy_pct;
  const err = m.error_count ?? 0;
  if (acc === null || acc === undefined) return { label: '—', cls: 'text-slate-400' };
  if (acc >= 98 && err === 0) return { label: 'Excellente', cls: 'text-emerald-600' };
  if (acc >= 90 && err <= 2)  return { label: 'Bonne', cls: 'text-blue-600' };
  if (acc >= 75)              return { label: 'Moyenne', cls: 'text-amber-600' };
  return { label: 'Faible', cls: 'text-rose-600' };
};

/** Export CSV côté client (séparateur « ; », BOM UTF-8). columns : [{ label, value: (row) => … }] */
export function downloadCsv(filename, columns, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.label)).join(';')];
  for (const r of rows) lines.push(columns.map((c) => esc(c.value(r))).join(';'));
  const blob = new Blob([String.fromCharCode(0xFEFF) + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const todayIso = () => new Date().toISOString().slice(0, 10);
export const daysAgoIso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
