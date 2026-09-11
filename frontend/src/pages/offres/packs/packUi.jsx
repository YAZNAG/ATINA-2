// Petits composants et utilitaires partagés par les onglets Packs / Bundles.

export function money(n) {
  return `${Number(n ?? 0).toFixed(2)} MAD`;
}

export function formatDateTime(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR');
}

export function nodeLabel(node, nodes = [], nodeId = null) {
  const n = node || nodes.find((x) => x.id === nodeId);
  if (!n) return nodeId ? '—' : 'Sans node';
  return n.code ? `${n.code} — ${n.name_fr ?? ''}` : (n.name_fr ?? n.name ?? n.id);
}

export function apiError(err, fallback) {
  return err?.response?.data?.message || fallback;
}

export function StatusBadge({ active }) {
  return active
    ? <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Actif</span>
    : <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">Inactif</span>;
}

export function VisibilityBadge({ visible }) {
  return visible
    ? <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Visible app</span>
    : <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">Masqué app</span>;
}

const COMPONENT_STYLES = {
  ok:           'bg-emerald-50 text-emerald-700',
  rupture:      'bg-amber-50 text-amber-700',
  non_vendable: 'bg-red-50 text-red-600',
  absent:       'bg-red-50 text-red-600',
  inactif:      'bg-red-50 text-red-600',
};

export function ComponentBadge({ code, label }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${COMPONENT_STYLES[code] ?? 'bg-neutral-100 text-neutral-600'}`}>
      {label ?? code}
    </span>
  );
}

export function Toggle({ checked, onChange, disabled, title }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-emerald-500' : 'bg-neutral-300'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(3px)' }}
      />
    </button>
  );
}

/** Export CSV côté client (séparateur « ; », BOM UTF-8). */
export function exportCsv(filename, headers, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(';'), ...rows.map((r) => r.map(esc).join(';'))];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function capLabel(pack) {
  if (pack.max_pack_qty === null || pack.max_pack_qty === undefined) return 'Illimité';
  return `${pack.sold_count ?? 0} / ${pack.max_pack_qty}`;
}

export function vendableLabel(pack) {
  return pack.vendable_count === null || pack.vendable_count === undefined ? 'Illimité' : String(pack.vendable_count);
}
