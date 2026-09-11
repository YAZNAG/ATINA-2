import { useEffect, useRef, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { getSkus } from '../../../api/catalog.api';
import { searchPurchasingSkus } from '../../../api/purchasing.api';
import { inputCls } from './PurchasingUi';

/**
 * Recherche SKU (code, nom FR/AR, EAN) via GET /api/catalog/skus?search= ;
 * repli sur /api/purchasing/lookups/skus si l'utilisateur n'a pas la permission skus.view.
 */
export default function SkuSearchInput({ value, onSelect, placeholder = 'Rechercher un SKU (code, nom, EAN)…', disabled, excludeIds = [], autoFocus }) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const fallback = useRef(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        let rows;
        if (!fallback.current) {
          try {
            const { data } = await getSkus({ search: term || undefined, limit: 15, status: 'active' });
            rows = data.data || [];
          } catch (err) {
            if (err?.response?.status !== 403) throw err;
            fallback.current = true;
          }
        }
        if (fallback.current) {
          const { data } = await searchPurchasingSkus(term || undefined, 15);
          rows = data.data || [];
        }
        if (!cancelled) setResults(rows);
      } catch (err) {
        if (!cancelled) {
          setResults([]);
          setError(err?.response?.data?.message || 'Recherche SKU impossible');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, term ? 300 : 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [term, open]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
        <div className="min-w-0">
          <span className="font-mono text-xs text-neutral-500">{value.sku_code}</span>
          <span className="ml-2 font-medium text-neutral-800">{value.name_fr}</span>
        </div>
        {!disabled && (
          <button type="button" onClick={() => onSelect(null)} className="text-neutral-400 hover:text-neutral-700" title="Changer de SKU">
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  const visible = results.filter((r) => !excludeIds.includes(r.id));

  return (
    <div className="relative" ref={boxRef}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
      <input
        value={term}
        disabled={disabled}
        autoFocus={autoFocus}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
        placeholder={placeholder}
        className={`${inputCls} pl-9`}
      />
      {open && (
        <div className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-neutral-400"><Loader2 size={14} className="animate-spin" /> Recherche…</div>
          ) : error ? (
            <div className="px-3 py-3 text-sm text-[#E10600]">{error}</div>
          ) : visible.length === 0 ? (
            <div className="px-3 py-3 text-sm text-neutral-400">Aucun SKU trouvé.</div>
          ) : (
            visible.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { onSelect(s); setTerm(''); setOpen(false); }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-50"
              >
                <span className="min-w-0">
                  <span className="font-mono text-xs text-neutral-500">{s.sku_code}</span>
                  <span className="ml-2 text-neutral-800">{s.name_fr}</span>
                </span>
                <span className="shrink-0 text-xs text-neutral-400" dir="rtl">{s.name_ar}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
