import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ExternalLink } from 'lucide-react';
import { getSupplierPrices } from '../../../api/purchasing.api';
import { errMsg, fmtPrice, fmtQty, fmtDate, VALIDITY_LABELS } from '../purchasingUtils';

/**
 * Onglet « Prix fournisseurs » de la fiche SKU : lecture des prix d'achat par fournisseur
 * (supplier_prices), filtre Fournisseur, lien vers l'écran Fournisseurs.
 */
export default function SkuSupplierPricesPanel({ skuId }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [withInactive, setWithInactive] = useState(false);

  useEffect(() => {
    if (!skuId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    getSupplierPrices({ sku_id: skuId, all: true, ...(withInactive ? { include_inactive: true } : {}) })
      .then(({ data }) => { if (!cancelled) setRows(data.data || []); })
      .catch((err) => { if (!cancelled) { setRows([]); setError(errMsg(err, 'Chargement des prix fournisseurs impossible')); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [skuId, withInactive]);

  const suppliers = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => r.supplier && map.set(r.supplier.id, r.supplier));
    return [...map.values()].sort((a, b) => a.name_fr.localeCompare(b.name_fr));
  }, [rows]);

  const visible = supplierId ? rows.filter((r) => r.supplier_id === supplierId) : rows;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-800">Prix fournisseurs</h3>
          <p className="mt-1 text-xs text-neutral-400">Prix d'achat HT par fournisseur et palier de quantité (lecture seule).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#E10600] focus:ring-2 focus:ring-[#E10600]/15"
          >
            <option value="">Tous les fournisseurs</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name_fr}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-neutral-500">
            <input type="checkbox" checked={withInactive} onChange={(e) => setWithInactive(e.target.checked)} className="accent-[#E10600]" />
            Inclure les prix désactivés
          </label>
          <button
            type="button"
            onClick={() => navigate(`/purchasing/suppliers?tab=prices&sku_id=${skuId}`)}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <ExternalLink size={14} /> Gérer dans Fournisseurs
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 size={20} className="mx-auto animate-spin text-neutral-400" /></div>
      ) : error ? (
        <p className="py-12 text-center text-sm text-[#E10600]">{error}</p>
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-400">Aucun prix fournisseur pour ce SKU.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Fournisseur</th>
                <th className="px-3 py-2 font-medium text-right">Palier (qté)</th>
                <th className="px-3 py-2 font-medium text-right">Prix HT</th>
                <th className="px-3 py-2 font-medium">Validité</th>
                <th className="px-3 py-2 font-medium">Conditions</th>
                <th className="py-2 pl-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {visible.map((r) => {
                const v = VALIDITY_LABELS[r.validity_status] || VALIDITY_LABELS.current;
                return (
                  <tr key={r.id}>
                    <td className="py-2.5 pr-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/purchasing/suppliers?tab=detail&id=${r.supplier_id}`)}
                        className="font-medium text-neutral-800 hover:text-[#E10600] hover:underline"
                      >
                        {r.supplier?.name_fr}
                      </button>
                      {r.supplier?.code && <span className="ml-1.5 font-mono text-xs text-neutral-400">{r.supplier.code}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-neutral-600">{fmtQty(r.qty_min)} → {r.qty_max == null ? '∞' : fmtQty(r.qty_max)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-neutral-900">{fmtPrice(r.price_ht)}</td>
                    <td className="px-3 py-2.5 text-xs text-neutral-600">{fmtDate(r.valid_from)} → {r.valid_to ? fmtDate(r.valid_to) : 'sans fin'}</td>
                    <td className="px-3 py-2.5 text-xs text-neutral-500">
                      {r.supplier?.payment_terms || '—'}
                      {r.supplier?.lead_time_days != null && <span className="block">Délai : {r.supplier.lead_time_days} j</span>}
                    </td>
                    <td className="py-2.5 pl-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${v.cls}`}>{v.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
