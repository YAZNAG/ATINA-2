import { useEffect, useRef } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { getBestSupplierPrice } from '../../../api/purchasing.api';
import SkuSearchInput from './SkuSearchInput';
import { inputCls, btnSecondary } from './PurchasingUi';
import { fmtMoney } from '../purchasingUtils';

let seq = 0;
export const newLine = (patch = {}) => ({
  key: `l${Date.now()}_${seq++}`,
  sku: null,
  qty_ordered: '1',
  unit_price_ht: '',
  price_source: 'none', // grid | manual | none | loading
  ...patch,
});

/** Lignes d'un BC existant → lignes éditables. */
export const linesFromItems = (items = []) =>
  items.map((it) => newLine({
    id: it.id,
    sku: it.sku,
    qty_ordered: String(it.qty_ordered),
    unit_price_ht: String(it.unit_price_ht),
    price_source: 'manual',
  }));

export const linesTotal = (lines) =>
  lines.reduce((s, l) => s + (Number(l.qty_ordered) || 0) * (Number(l.unit_price_ht) || 0), 0);

/** Lignes → payload API ({ sku_id, qty_ordered, unit_price_ht }). */
export const linesPayload = (lines) =>
  lines.filter((l) => l.sku).map((l) => ({
    sku_id: l.sku.id,
    qty_ordered: l.qty_ordered,
    ...(l.unit_price_ht !== '' ? { unit_price_ht: l.unit_price_ht } : {}),
  }));

/**
 * Éditeur de lignes de BC : recherche SKU, quantité (unité d'achat), prix HT.
 * Le prix est proposé depuis la grille fournisseur (palier applicable) tant qu'il n'a pas été saisi à la main.
 */
export default function PoLinesEditor({ lines, setLines, supplierId }) {
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const timers = useRef({});

  const patch = (key, p) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));

  const fetchPrice = async (key, sku, qty) => {
    if (!supplierId || !sku) return;
    patch(key, { price_source: 'loading' });
    try {
      const { data } = await getBestSupplierPrice({ supplier_id: supplierId, sku_id: sku.id, qty: Number(qty) > 0 ? Number(qty) : 1 });
      const p = data.data;
      setLines((ls) => ls.map((l) => {
        if (l.key !== key || l.price_source === 'manual') return l;
        return p ? { ...l, unit_price_ht: String(p.price_ht), price_source: 'grid' } : { ...l, price_source: 'none' };
      }));
    } catch {
      setLines((ls) => ls.map((l) => (l.key === key && l.price_source === 'loading' ? { ...l, price_source: 'none' } : l)));
    }
  };

  // Changement de fournisseur → re-proposer les prix grille des lignes non saisies à la main.
  useEffect(() => {
    linesRef.current.forEach((l) => {
      if (l.sku && l.price_source !== 'manual') fetchPrice(l.key, l.sku, l.qty_ordered);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const onSku = (line, sku) => {
    patch(line.key, { sku, ...(sku ? {} : { unit_price_ht: '', price_source: 'none' }) });
    if (sku && line.price_source !== 'manual') fetchPrice(line.key, sku, line.qty_ordered);
  };

  const onQty = (line, value) => {
    patch(line.key, { qty_ordered: value });
    if (line.sku && line.price_source !== 'manual') {
      clearTimeout(timers.current[line.key]);
      timers.current[line.key] = setTimeout(() => fetchPrice(line.key, line.sku, value), 400);
    }
  };

  const onPrice = (line, value) => patch(line.key, { unit_price_ht: value, price_source: value === '' ? 'none' : 'manual' });

  const remove = (key) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : [newLine()]));

  const usedIds = lines.map((l) => l.sku?.id).filter(Boolean);
  const total = linesTotal(lines);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="w-10 px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">SKU</th>
              <th className="w-32 px-3 py-2.5 font-medium text-right">Qté commandée</th>
              <th className="w-44 px-3 py-2.5 font-medium text-right">Prix HT unitaire</th>
              <th className="w-36 px-3 py-2.5 font-medium text-right">Total HT</th>
              <th className="w-12 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {lines.map((l, idx) => (
              <tr key={l.key} className="align-top">
                <td className="px-3 py-2.5 text-xs text-neutral-400">{idx + 1}</td>
                <td className="px-3 py-2.5">
                  <SkuSearchInput value={l.sku} onSelect={(s) => onSku(l, s)} excludeIds={usedIds} />
                  {l.sku && (
                    <p className="mt-1 text-xs text-neutral-400">
                      Unité d'achat : {l.sku.unit_purchase || '—'}
                      {Number(l.sku.coeff) > 1 ? ` · coeff ${Number(l.sku.coeff)} ${l.sku.unit_sale || ''} / unité d'achat` : ''}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <input type="number" min="0" step="0.001" value={l.qty_ordered} onChange={(e) => onQty(l, e.target.value)} className={`${inputCls} text-right`} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="relative">
                    <input type="number" min="0" step="0.0001" value={l.unit_price_ht} onChange={(e) => onPrice(l, e.target.value)} placeholder="Prix HT" className={`${inputCls} pr-8 text-right`} />
                    {l.price_source === 'loading' && <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-neutral-400" />}
                  </div>
                  <p className="mt-1 text-right text-[11px] text-neutral-400">
                    {l.price_source === 'grid' && 'Prix grille fournisseur'}
                    {l.price_source === 'manual' && 'Prix saisi'}
                    {l.price_source === 'none' && l.sku && (supplierId ? 'Aucun prix grille : saisissez le prix' : 'Choisissez un fournisseur')}
                  </p>
                </td>
                <td className="px-3 py-2.5 pt-4 text-right font-medium tabular-nums text-neutral-800">
                  {fmtMoney((Number(l.qty_ordered) || 0) * (Number(l.unit_price_ht) || 0))}
                </td>
                <td className="px-3 py-2.5 pt-3">
                  <button type="button" onClick={() => remove(l.key)} className="rounded-lg p-2 text-red-500 transition hover:bg-red-50" title="Retirer la ligne">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-neutral-200 bg-neutral-50">
            <tr>
              <td colSpan={4} className="px-3 py-3 text-right text-sm font-semibold text-neutral-700">Total HT</td>
              <td className="px-3 py-3 text-right text-sm font-bold tabular-nums text-neutral-900">{fmtMoney(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <button type="button" className={btnSecondary} onClick={() => setLines((ls) => [...ls, newLine()])}>
        <Plus size={16} /> Ajouter ligne
      </button>
    </div>
  );
}
