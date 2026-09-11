/**
 * Composants et utilitaires partagés des écrans Reporting / Supervision.
 * Aucun graphique externe : barres SVG / CSS uniquement.
 */
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

// ── Formatage ────────────────────────────────────────────────────────────────
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const nf3 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
const nfMoney = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtInt = (v) => (v === null || v === undefined ? '—' : nf0.format(Number(v)));
export const fmtNum = (v) => (v === null || v === undefined ? '—' : nf3.format(Number(v)));
export const fmtDec1 = (v) => (v === null || v === undefined ? '—' : nf1.format(Number(v)));
export const fmtMoney = (v) => (v === null || v === undefined ? '—' : `${nfMoney.format(Number(v))} MAD`);
export const fmtPct = (v) => (v === null || v === undefined ? '—' : `${nf1.format(Number(v))} %`);
/** Jours de couverture : null = stock disponible mais aucune vente sur 30 j → ∞. */
export const fmtCoverage = (v) => (v === null || v === undefined ? '∞' : `${nf1.format(Number(v))} j`);
export const fmtDateTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
export const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const apiError = (err, fallback = 'Erreur lors du chargement des données') =>
  err?.response?.data?.message || err?.message || fallback;

/** Supprime les paramètres vides avant appel API. */
export const cleanParams = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== false));

// ── Export CSV (séparateur « ; », BOM UTF-8) ────────────────────────────────
const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Télécharge un CSV. `sections` = [{ title?, headers: [], rows: [[]] }].
 */
export function downloadCsv(filename, sections) {
  const lines = [];
  sections.forEach((sec, i) => {
    if (i > 0) lines.push('');
    if (sec.title) lines.push(csvCell(sec.title));
    if (sec.headers) lines.push(sec.headers.map(csvCell).join(';'));
    (sec.rows || []).forEach((row) => lines.push(row.map(csvCell).join(';')));
  });
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Couleurs ─────────────────────────────────────────────────────────────────
export const STATUS_HEX = {
  orange: '#f97316', blue: '#3b82f6', purple: '#a855f7', cyan: '#06b6d4', indigo: '#6366f1',
  green: '#22c55e', red: '#ef4444', gray: '#94a3b8', yellow: '#eab308', amber: '#f59e0b',
};
export const statusHex = (c) => (c && c.startsWith('#') ? c : STATUS_HEX[c] || '#94a3b8');

export const STATE_CONFIG = {
  rupture: { label: 'Rupture', className: 'bg-red-100 text-red-700 ring-1 ring-red-200' },
  alert: { label: 'Alerte (≤ seuil)', className: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200' },
  ok: { label: 'OK', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
};

export function StateBadge({ state }) {
  const cfg = STATE_CONFIG[state] || STATE_CONFIG.ok;
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>{cfg.label}</span>;
}

/** Couleur de cellule heatmap selon l'état et la couverture. */
export function heatColor(cell, threshold) {
  if (!cell) return { bg: '#f1f5f9', fg: '#94a3b8' };
  if (cell.state === 'rupture') return { bg: '#dc2626', fg: '#ffffff' };
  if (cell.state === 'alert') return { bg: '#f59e0b', fg: '#1f2937' };
  const c = cell.coverage_days;
  if (c === null || c === undefined) return { bg: '#d1fae5', fg: '#065f46' };
  if (c <= threshold) return { bg: '#fde68a', fg: '#78350f' };
  if (c <= threshold * 2) return { bg: '#bbf7d0', fg: '#14532d' };
  return { bg: '#22c55e', fg: '#ffffff' };
}

// ── UI ───────────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, sub, icon: Icon, tone = 'slate', onClick, title }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    red: 'bg-red-50 text-red-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className={`group relative flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-500/30' : ''
      }`}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 truncate text-2xl font-bold text-slate-900">{value}</p>
        {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
      </div>
      {Icon ? (
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[tone] || tones.slate}`}>
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      {onClick ? <span className="absolute bottom-2 right-3 text-[10px] font-medium text-red-600 opacity-0 transition group-hover:opacity-100">Voir le détail →</span> : null}
    </Tag>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            active === t.key ? 'border-red-600 text-red-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function LoadingBlock({ label = 'Chargement…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
      <span>{message}</span>
      {onRetry ? <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={onRetry}>Réessayer</button> : null}
    </div>
  );
}

export function EmptyBlock({ children = 'Aucune donnée pour les filtres sélectionnés.' }) {
  return <div className="py-10 text-center text-sm text-slate-500">{children}</div>;
}

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total } = pagination;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
      <span>{fmtInt(total)} ligne(s) — page {page} / {pages}</span>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary !px-2 !py-1.5" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Page précédente">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" className="btn-secondary !px-2 !py-1.5" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Page suivante">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Histogramme SVG simple (tendance). points = [{ label, value, sub? }].
 */
export function TrendBars({ points, valueFormatter = fmtInt, color = '#dc2626', height = 180, emptyLabel }) {
  if (!points || points.length === 0) return <EmptyBlock>{emptyLabel}</EmptyBlock>;
  const max = Math.max(...points.map((p) => Number(p.value) || 0), 0);
  const allZero = max === 0;
  const W = Math.max(points.length * 28, 320);
  const H = height;
  const padB = 28;
  const padT = 16;
  const bw = (W / points.length) * 0.62;
  const step = W / points.length;
  const labelEvery = Math.ceil(points.length / 16);
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[180px] w-full min-w-[320px]" preserveAspectRatio="none" role="img" aria-label="Graphique de tendance">
        <line x1="0" y1={H - padB} x2={W} y2={H - padB} stroke="#e2e8f0" strokeWidth="1" />
        {points.map((p, i) => {
          const v = Number(p.value) || 0;
          const h = allZero ? 0 : ((H - padB - padT) * v) / max;
          const x = i * step + (step - bw) / 2;
          return (
            <g key={`${p.label}-${i}`}>
              <title>{`${p.label} : ${valueFormatter(v)}${p.sub ? ` — ${p.sub}` : ''}`}</title>
              <rect x={x} y={H - padB - h} width={bw} height={Math.max(h, v > 0 ? 2 : 0)} rx="3" fill={color} opacity="0.85" />
              <rect x={i * step} y={padT} width={step} height={H - padB - padT} fill="transparent" />
              {i % labelEvery === 0 ? (
                <text x={i * step + step / 2} y={H - 10} textAnchor="middle" fontSize="10" fill="#64748b">{p.label}</text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {allZero ? <p className="mt-1 text-center text-xs text-slate-400">Aucune activité sur la période.</p> : null}
    </div>
  );
}

/** Barres horizontales CSS (répartition). items = [{ key, label, value, color, sub? , onClick? }] */
export function HBars({ items, valueFormatter = fmtInt }) {
  const max = Math.max(...items.map((i) => Number(i.value) || 0), 0);
  if (!items.length) return <EmptyBlock />;
  return (
    <div className="space-y-2">
      {items.map((it) => {
        const pct = max ? Math.round(((Number(it.value) || 0) / max) * 100) : 0;
        const Row = it.onClick ? 'button' : 'div';
        return (
          <Row
            key={it.key}
            type={it.onClick ? 'button' : undefined}
            onClick={it.onClick}
            className={`block w-full text-left ${it.onClick ? 'rounded-md hover:bg-slate-50' : ''}`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">{it.label}</span>
              <span className="text-slate-500">{valueFormatter(it.value)}{it.sub ? ` · ${it.sub}` : ''}</span>
            </div>
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: it.color || '#dc2626' }} />
            </div>
          </Row>
        );
      })}
    </div>
  );
}

export function SectionCard({ title, subtitle, actions, children, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title ? <h3 className="text-sm font-semibold text-slate-800">{title}</h3> : null}
            {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
