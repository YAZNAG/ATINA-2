import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, Search } from 'lucide-react';
import { getPayments } from '../../api/orders_mgmt.api';
import { downloadCsv } from './csv';

// Vue transversale des paiements à la livraison (US-060) — filtres Statut paiement / Période.
const STATUS_TONE = {
  pending: 'bg-amber-50 text-amber-600',
  collected: 'bg-emerald-50 text-emerald-600',
  failed: 'bg-rose-50 text-rose-600',
  refunded: 'bg-gray-100 text-gray-500',
};

const money = (v) => `${Number(v ?? 0).toFixed(2)} MAD`;
const dt = (v) => (v ? new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–');

export default function PaymentsView({ nodes = [], onOpenOrder }) {
  const [filters, setFilters] = useState({ status_code: '', node_id: '', date_from: '', date_to: '', search: '' });
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const params = useCallback((extra = {}) => {
    const p = {};
    for (const [k, v] of Object.entries(filters)) if (v) p[k] = v;
    return { ...p, ...extra };
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPayments(params({ page: pagination.page, limit: pagination.limit }));
      setRows(res.data.data || []);
      setTotals(res.data.totals || []);
      setPagination((p) => ({ ...p, ...(res.data.pagination || {}) }));
    } catch (err) {
      setError(err?.response?.data?.message || 'Erreur lors du chargement des paiements');
    } finally {
      setLoading(false);
    }
  }, [params, pagination.page, pagination.limit]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const setF = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPagination((p) => ({ ...p, page: 1 })); };

  async function exportCsv() {
    setExporting(true);
    try {
      const all = [];
      let page = 1; let pages = 1;
      do {
        const res = await getPayments(params({ page, limit: 200 }));
        all.push(...(res.data.data || []));
        pages = res.data.pagination?.pages || 1;
        page += 1;
      } while (page <= pages && page <= 50);
      downloadCsv(`paiements-${new Date().toISOString().slice(0, 10)}.csv`,
        ['N° commande', 'Date commande', 'Client', 'Nœud', 'Statut commande', 'Mode', 'Montant', 'Statut paiement', 'Encaissé le', 'Encaissé par', 'Notes'],
        all.map((p) => [
          `ORD-${p.order?.id?.slice(0, 8).toUpperCase()}`, dt(p.order?.created_at), p.order?.customer?.name || '',
          p.order?.node?.name_fr || '', p.order?.status?.name_fr || '', p.payment_method?.name_fr || p.payment_method?.code || '',
          Number(p.amount ?? 0).toFixed(2), p.status?.name_fr || p.status?.code || '', p.collected_at ? dt(p.collected_at) : '',
          p.collected_by || '', p.notes || '',
        ]));
    } catch (err) {
      setError(err?.response?.data?.message || "Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-6 py-4">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={filters.search} onChange={(e) => setF('search', e.target.value)} placeholder="Client, téléphone…" className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-red-300 focus:outline-none" />
        </div>
        <select value={filters.status_code} onChange={(e) => setF('status_code', e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="">Tous les statuts de paiement</option>
          <option value="pending">À encaisser</option>
          <option value="collected">Encaissé</option>
          <option value="failed">Échoué / annulé</option>
          <option value="refunded">Remboursé</option>
        </select>
        <select value={filters.node_id} onChange={(e) => setF('node_id', e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="">Tous les nœuds</option>
          {nodes.map((n) => <option key={n.id} value={n.id}>{n.name_fr}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-500">Du
          <input type="date" value={filters.date_from} onChange={(e) => setF('date_from', e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-500">Au
          <input type="date" value={filters.date_to} onChange={(e) => setF('date_to', e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
        </label>
        <button type="button" onClick={exportCsv} disabled={exporting} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Exporter
        </button>
      </div>

      {totals.length > 0 && (
        <div className="flex flex-wrap gap-3 border-b border-gray-100 px-6 py-3">
          {totals.map((t) => (
            <div key={t.status || 'x'} className={`rounded-lg px-3 py-2 text-xs ${STATUS_TONE[t.status] || 'bg-gray-100 text-gray-600'}`}>
              <div className="font-medium">{t.name_fr || t.status}</div>
              <div className="text-sm font-semibold">{money(t.amount)} <span className="text-xs font-normal">({t.count})</span></div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="mx-6 mt-3 rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="px-6 py-3 font-medium">Commande</th>
              <th className="px-3 py-3 font-medium">Client</th>
              <th className="px-3 py-3 font-medium">Nœud</th>
              <th className="px-3 py-3 font-medium">Statut commande</th>
              <th className="px-3 py-3 font-medium">Mode</th>
              <th className="px-3 py-3 font-medium">Montant</th>
              <th className="px-3 py-3 font-medium">Paiement</th>
              <th className="px-3 py-3 font-medium">Encaissé le / par</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-400">Chargement…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-400">Aucun paiement ne correspond aux filtres.</td></tr>}
            {!loading && rows.map((p) => (
              <tr key={p.id} onClick={() => p.order?.id && onOpenOrder?.(p.order.id)} className="cursor-pointer border-t border-gray-50 hover:bg-gray-50/60">
                <td className="px-6 py-3 font-medium text-red-600">ORD-{p.order?.id?.slice(0, 8).toUpperCase()}</td>
                <td className="px-3 py-3">{p.order?.customer?.name || '–'}</td>
                <td className="px-3 py-3 text-gray-600">{p.order?.node?.name_fr || '–'}</td>
                <td className="px-3 py-3 text-gray-600">{p.order?.status?.name_fr || '–'}</td>
                <td className="px-3 py-3 text-gray-600">{p.payment_method?.name_fr || p.payment_method?.code || '–'}</td>
                <td className="px-3 py-3 font-medium">{money(p.amount)}</td>
                <td className="px-3 py-3"><span className={`rounded-md px-2 py-1 text-xs font-medium ${STATUS_TONE[p.status?.code] || 'bg-gray-100 text-gray-500'}`}>{p.status?.name_fr || p.status?.code}</span></td>
                <td className="px-3 py-3 text-xs text-gray-500">{p.collected_at ? `${dt(p.collected_at)} — ${p.collected_by || ''}` : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 text-sm text-gray-400">
        <span>{pagination.total} paiement(s)</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))} className="rounded-md px-2 py-1 hover:bg-gray-100 disabled:opacity-30">◄</button>
          <span>{pagination.page}/{pagination.pages || 1}</span>
          <button type="button" disabled={pagination.page >= (pagination.pages || 1)} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))} className="rounded-md px-2 py-1 hover:bg-gray-100 disabled:opacity-30">►</button>
        </div>
      </div>
    </div>
  );
}
