import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

export const inputCls =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#E10600] focus:ring-2 focus:ring-[#E10600]/15 disabled:bg-neutral-50 disabled:text-neutral-400';

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-[#E10600] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#c00500] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';
export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50';
export const btnDanger =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50';
export const iconBtn =
  'rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-40';

/** Notification éphémère (même rendu que les pages Master Data). */
export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const show = useCallback((type, message) => {
    setToast({ type, message });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = toast ? (
    <div
      className={`fixed right-5 top-5 z-[70] max-w-md rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
        toast.type === 'success' ? 'bg-emerald-600' : 'bg-[#E10600]'
      }`}
    >
      {toast.message}
    </div>
  ) : null;
  return { show, node };
}

export function TabBar({ tabs, active, onChange }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-neutral-200">
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              active === t.key ? 'border-[#E10600] text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-600'
            }`}
          >
            {Icon && <Icon size={15} />}
            {t.label}
            {t.badge ? <span className="ml-1 rounded-full bg-neutral-100 px-1.5 text-[11px] text-neutral-600">{t.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function Pill({ cls, children, style }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${cls || ''}`} style={style}>
      {children}
    </span>
  );
}

/** Badge de statut de BC, couleur issue du référentiel po_statuses. */
export function PoStatusPill({ status }) {
  if (!status) return <span className="text-neutral-400">—</span>;
  const color = status.color || '#64748b';
  return (
    <Pill style={{ backgroundColor: `${color}1a`, color }}>
      {status.name_fr}
    </Pill>
  );
}

export function Field({ label, required, hint, error, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-neutral-600">
        {label} {required && <span className="text-[#E10600]">*</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-[#E10600]">{error}</span> : hint ? <span className="mt-1 block text-xs text-neutral-400">{hint}</span> : null}
    </label>
  );
}

export function Card({ title, actions, children, className = '' }) {
  return (
    <div className={`rounded-xl border border-neutral-200 bg-white p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Spinner({ className = 'py-12' }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Loader2 size={20} className="animate-spin text-neutral-400" />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-200 bg-white px-6 py-14 text-center text-neutral-400">
      {Icon && <Icon size={28} />}
      <p className="text-sm font-medium text-neutral-600">{title}</p>
      {children && <div className="text-sm">{children}</div>}
    </div>
  );
}

export function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 py-2 text-sm last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-neutral-800">{value ?? '—'}</span>
    </div>
  );
}

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) {
    return pagination ? <p className="mt-3 text-xs text-neutral-400">{pagination.total} résultat(s)</p> : null;
  }
  const { page, pages, total } = pagination;
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-neutral-500">
      <span className="text-xs">{total} résultat(s) — page {page} / {pages}</span>
      <div className="flex gap-1">
        <button type="button" className={iconBtn} disabled={page <= 1} onClick={() => onPage(page - 1)} title="Page précédente">
          <ChevronLeft size={16} />
        </button>
        <button type="button" className={iconBtn} disabled={page >= pages} onClick={() => onPage(page + 1)} title="Page suivante">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
