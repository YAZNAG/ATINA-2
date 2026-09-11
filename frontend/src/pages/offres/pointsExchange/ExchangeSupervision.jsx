import { useCallback, useEffect, useState } from 'react';
import { Download, Eye, RefreshCw } from 'lucide-react';
import { getPointsExchanges } from '../../../api/pointsExchange.api';
import { getOrderStatuses } from '../../../api/orders.api';
import { apiError, nodeLabel, formatDateTime, points, exportCsv } from './pxUi';

const PAGE_SIZE = 20;

// Repli si la liste des statuts n'est pas accessible (codes seedés).
const DEFAULT_STATUSES = [
  { code: 'pending', name_fr: 'En attente' }, { code: 'confirmed', name_fr: 'Confirmée' },
  { code: 'picking', name_fr: 'En préparation' }, { code: 'ready', name_fr: 'Prête' },
  { code: 'in_delivery', name_fr: 'En livraison' }, { code: 'delivered', name_fr: 'Livrée' },
  { code: 'cancelled', name_fr: 'Annulée' }, { code: 'returned', name_fr: 'Retournée' },
  { code: 'awaiting_stock', name_fr: 'En attente de stock' },
];

const TXN_LABELS = { sku_exchange: 'Échange (débit)', exchange_revert: 'Recrédit (annulation)' };

/**
 * Onglet « Supervision des échanges » (US-089) — LECTURE SEULE : commandes confirmées
 * contenant des lignes d'échange (order_items.is_points_exchange = TRUE).
 */
export default function ExchangeSupervision({ nodes = [] }) {
  const [filters, setFilters] = useState({ node_id: '', status: '', customer: '', date_from: '', date_to: '' });
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getOrderStatuses({ limit: 100 })
      .then(({ data }) => { const list = data.data ?? []; if (list.length) setStatuses(list); })
      .catch(() => {});
  }, []);

  const params = useCallback((extra = {}) => {
    const p = { page, limit: PAGE_SIZE, ...extra };
    Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v; });
    return p;
  }, [filters, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getPointsExchanges(params());
      setRows(data.data ?? []);
      setSummary(data.summary ?? null);
      setPagination(data.pagination ?? { total: 0, pages: 1 });
    } catch (err) {
      setError(apiError(err, 'Impossible de charger les échanges'));
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    const t = setTimeout(load, filters.customer ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, filters.customer]);
  useEffect(() => { setPage(1); }, [filters]);

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  async function handleExport() {
    try {
      const { data } = await getPointsExchanges(params({ all: true, page: 1 }));
      const lines = [];
      (data.data ?? []).forEach((o) => {
        o.lines.forEach((l) => lines.push([
          formatDateTime(o.created_at), o.order_id, nodeLabel(o.node), o.customer?.name,
          `${o.customer?.phone_country ?? ''}${o.customer?.phone_number ?? ''}`, o.status?.name_fr ?? o.status?.code,
          l.sku?.sku_code, l.sku?.name_fr, l.qty, l.points_spent, o.points_redeemed,
        ]));
      });
      exportCsv(`echanges_points_${new Date().toISOString().slice(0, 10)}.csv`,
        ['Date', 'Commande', 'Node', 'Client', 'Téléphone', 'Statut', 'SKU', 'Produit', 'Qté', 'Points dépensés (ligne)', 'Total points commande'],
        lines);
    } catch (err) {
      setError(apiError(err, 'Export impossible'));
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 !p-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="form-label">Node</label>
            <select className="form-select" value={filters.node_id} onChange={setFilter('node_id')}>
              <option value="">Tous les nodes</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{nodeLabel(n)}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Du</label>
            <input type="date" className="form-input" value={filters.date_from} onChange={setFilter('date_from')} />
          </div>
          <div>
            <label className="form-label">Au</label>
            <input type="date" className="form-input" value={filters.date_to} onChange={setFilter('date_to')} />
          </div>
          <div>
            <label className="form-label">Client</label>
            <input className="form-input" placeholder="Nom ou téléphone" value={filters.customer} onChange={setFilter('customer')} />
          </div>
          <div>
            <label className="form-label">Statut commande</label>
            <select className="form-select" value={filters.status} onChange={setFilter('status')}>
              <option value="">Tous statuts</option>
              {statuses.map((s) => <option key={s.code} value={s.code}>{s.name_fr ?? s.code}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={load}><RefreshCw size={16} /> Rafraîchir</button>
          <button type="button" className="btn-secondary" onClick={handleExport}><Download size={16} /> Exporter CSV</button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
        <Eye size={14} /> Lecture seule : seuls les échanges de commandes confirmées apparaissent (un panier non confirmé ne débite rien).
        Le solde et l'ajustement des points d'un client se gèrent depuis sa fiche.
      </div>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card !p-4"><p className="text-xs text-slate-500">Commandes avec échange</p><p className="mt-1 text-2xl font-semibold text-slate-800">{summary.orders}</p></div>
          <div className="card !p-4"><p className="text-xs text-slate-500">Unités échangées</p><p className="mt-1 text-2xl font-semibold text-slate-800">{summary.qty}</p></div>
          <div className="card !p-4"><p className="text-xs text-slate-500">Points dépensés</p><p className="mt-1 text-2xl font-semibold text-red-600">{points(summary.points_spent)}</p></div>
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <div className="table-wrap">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="table-th">Date</th>
                <th className="table-th">Commande</th>
                <th className="table-th">Node</th>
                <th className="table-th">Client</th>
                <th className="table-th">SKU échangés (qté · points)</th>
                <th className="table-th">Total points</th>
                <th className="table-th">Transactions points</th>
                <th className="table-th">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={8} className="table-td py-8 text-center text-slate-400">Chargement…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="table-td py-10 text-center text-slate-400">Aucun échange de points pour ces filtres.</td></tr>
              )}
              {!loading && rows.map((o) => (
                <tr key={o.order_id} className="align-top">
                  <td className="table-td whitespace-nowrap">{formatDateTime(o.created_at)}</td>
                  <td className="table-td font-mono text-xs">#{o.order_id.slice(0, 8)}</td>
                  <td className="table-td whitespace-nowrap">{nodeLabel(o.node)}</td>
                  <td className="table-td">
                    <div className="text-slate-800">{o.customer?.name}</div>
                    <div className="text-xs text-slate-400">{o.customer?.phone_country}{o.customer?.phone_number}</div>
                  </td>
                  <td className="table-td">
                    <ul className="space-y-0.5">
                      {o.lines.map((l) => (
                        <li key={l.id} className="text-sm">
                          <span className="text-slate-800">{l.sku?.sku_code}</span> — {l.sku?.name_fr} · ×{l.qty} · {points(l.points_spent)}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="table-td whitespace-nowrap">
                    <div className="font-semibold text-slate-800">{points(o.points_redeemed)}</div>
                    {o.lines_points_total !== o.points_redeemed && (
                      <div className="text-xs text-amber-600">Lignes : {points(o.lines_points_total)}</div>
                    )}
                  </td>
                  <td className="table-td">
                    {o.transactions.length === 0 ? <span className="text-xs text-slate-400">—</span> : (
                      <ul className="space-y-0.5 text-xs">
                        {o.transactions.map((t) => (
                          <li key={t.id} className={t.points < 0 ? 'text-red-600' : 'text-emerald-600'}>
                            {TXN_LABELS[t.type] ?? t.type} : {t.points > 0 ? '+' : ''}{t.points} · {formatDateTime(t.created_at)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="table-td">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{o.status?.name_fr ?? o.status?.code}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
            <span>{pagination.total} commande(s)</span>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary !py-1.5" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>Précédent</button>
              <span className="self-center">Page {page} / {pagination.pages}</span>
              <button type="button" className="btn-secondary !py-1.5" disabled={page >= pagination.pages} onClick={() => setPage((x) => x + 1)}>Suivant</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
