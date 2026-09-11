import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, Download, Eye, Filter, RefreshCw, UserCog } from 'lucide-react';
import OrderDetailDrawer from '../commandes/OrderDetailDrawer';
import { useAuth } from '../../context/AuthContext';
import { getPickingSessions, exportPickingSessions, getPickers } from '../../api/picking.api';
import { getNodes } from '../../api/locationNode.api';
import { getErrorMessage } from '../../utils/helpers';
import ReassignPickerModal from './ReassignPickerModal';
import {
  sessionRef, orderRef, fmtDateTime, fmtMinutes, fmtQty, SESSION_STATUS_STYLE, SESSION_STATUSES, performanceOf, downloadCsv, todayIso, daysAgoIso,
} from './pickingUtils';

const EMPTY_ACTIVE  = { node_id: '', picker_id: '', status_code: '', date_from: '', date_to: '', unassigned: false };
const EMPTY_HISTORY = { node_id: '', picker_id: '', status_code: '', date_from: daysAgoIso(29), date_to: todayIso() };

/**
 * Onglets « Sessions en cours » (mode='active') et « Historique » (mode='history').
 * Filtres : node, picker, statut, date/période. Actions : Filtrer, Exporter, Réassigner (en cours).
 */
export default function SessionsListTab({ mode, onOpen }) {
  const isHistory = mode === 'history';
  const { hasPermission } = useAuth();
  const canReassign = ['picking.update', 'picking.reassign', 'dashboard.view'].some((c) => hasPermission(c));

  const empty = isHistory ? EMPTY_HISTORY : EMPTY_ACTIVE;
  const [draft, setDraft] = useState(empty);
  const [filters, setFilters] = useState(empty);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [pickers, setPickers] = useState([]);
  const [reassign, setReassign] = useState(null);
  const [orderId, setOrderId] = useState(null);

  useEffect(() => {
    getNodes({ all: true, limit: 500 }).then((r) => setNodes(r.data?.data ?? r.data ?? [])).catch(() => {});
  }, []);
  useEffect(() => {
    getPickers(draft.node_id ? { node_id: draft.node_id } : {}).then((r) => setPickers(r.data?.data ?? [])).catch(() => setPickers([]));
  }, [draft.node_id]);

  const params = useMemo(() => {
    const p = { scope: mode };
    if (filters.node_id) p.node_id = filters.node_id;
    if (filters.picker_id) p.picker_id = filters.picker_id;
    if (filters.status_code) p.status_code = filters.status_code;
    if (filters.date_from) p.date_from = filters.date_from;
    if (filters.date_to) p.date_to = filters.date_to;
    if (!isHistory && filters.unassigned) p.unassigned = 'true';
    return p;
  }, [filters, mode, isHistory]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await getPickingSessions({ ...params, page, limit: 25, ...(!isHistory && { with_counts: 'true' }) });
      setRows(r.data?.data ?? []);
      setPagination(r.data?.pagination ?? { total: 0, pages: 0 });
      if (r.data?.counts) setCounts(r.data.counts);
    } catch (err) {
      setError(getErrorMessage(err)); setRows([]);
    } finally { setLoading(false); }
  }, [params, page, isHistory]);

  useEffect(() => { load(); }, [load]);

  const applyFilters = (e) => { e?.preventDefault(); setPage(1); setFilters({ ...draft }); };
  const resetFilters = () => { setDraft(empty); setFilters(empty); setPage(1); };

  const handleExport = async () => {
    setExporting(true);
    try {
      const r = await exportPickingSessions(params);
      const data = r.data?.data ?? [];
      if (!data.length) { toast('Aucune session à exporter'); return; }
      const cols = [
        { label: 'Session', value: (s) => sessionRef(s.id) },
        { label: 'Commande', value: (s) => orderRef(s.order_id) },
        { label: 'Client', value: (s) => s.order?.customer?.name ?? '' },
        { label: 'Node', value: (s) => s.node?.code ?? '' },
        { label: 'Picker', value: (s) => s.picker?.name ?? 'Non assigné' },
        { label: 'Statut', value: (s) => s.status?.name_fr ?? '' },
        { label: 'Créée le', value: (s) => fmtDateTime(s.created_at) },
        { label: 'Début', value: (s) => fmtDateTime(s.started_at) },
        { label: 'Fin', value: (s) => fmtDateTime(s.completed_at) },
        { label: 'Durée (min)', value: (s) => s.metrics?.duration_min ?? '' },
        { label: 'Lignes traitées', value: (s) => `${s.metrics?.items_processed ?? 0}/${s.metrics?.items_total ?? 0}` },
        { label: 'Qté attendue', value: (s) => fmtQty(s.metrics?.qty_expected) },
        { label: 'Qté prélevée', value: (s) => fmtQty(s.metrics?.qty_picked) },
        { label: 'Taux de prélèvement (%)', value: (s) => s.metrics?.accuracy_pct ?? '' },
        { label: 'Erreurs', value: (s) => s.error_count ?? 0 },
        { label: 'Lignes/min', value: (s) => s.metrics?.items_per_min ?? '' },
        { label: 'Performance', value: (s) => performanceOf(s.metrics).label },
      ];
      downloadCsv(`picking-${isHistory ? 'historique' : 'en-cours'}-${todayIso()}.csv`, cols, data);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setExporting(false); }
  };

  const statusOptions = SESSION_STATUSES.filter((s) => (isHistory ? ['completed', 'cancelled'] : ['open', 'in_progress']).includes(s.code));
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v, ...(k === 'node_id' ? { picker_id: '' } : {}) }));

  return (
    <div className="space-y-4">
      {reassign && (
        <ReassignPickerModal session={reassign} onClose={() => setReassign(null)} onDone={() => { setReassign(null); load(); }} />
      )}
      <OrderDetailDrawer orderId={orderId} onClose={() => setOrderId(null)} onChanged={load} />

      {/* Filtres */}
      <form onSubmit={applyFilters} className="card grid grid-cols-1 gap-3 !p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <label className="form-label">Node</label>
          <select className="form-select" value={draft.node_id} onChange={(e) => set('node_id', e.target.value)}>
            <option value="">Tous les nodes</option>
            {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} · {n.name_fr}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Picker</label>
          <select className="form-select" value={draft.picker_id} onChange={(e) => set('picker_id', e.target.value)} disabled={draft.unassigned}>
            <option value="">Tous les pickers</option>
            {pickers.map((p) => <option key={p.id} value={p.id}>{p.name}{p.node?.code ? ` (${p.node.code})` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Statut</label>
          <select className="form-select" value={draft.status_code} onChange={(e) => set('status_code', e.target.value)}>
            <option value="">{isHistory ? 'Terminées et annulées' : 'Ouvertes et en cours'}</option>
            {statusOptions.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">{isHistory ? 'Clôturée du' : 'Créée du'}</label>
          <input type="date" className="form-input" value={draft.date_from} onChange={(e) => set('date_from', e.target.value)} />
        </div>
        <div>
          <label className="form-label">au</label>
          <input type="date" className="form-input" value={draft.date_to} onChange={(e) => set('date_to', e.target.value)} />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button type="submit" className="btn-danger"><Filter size={16} />Filtrer</button>
          <button type="button" className="btn-secondary" onClick={resetFilters}>Réinitialiser</button>
        </div>
        {!isHistory && (
          <label className="flex items-center gap-2 text-sm text-slate-600 lg:col-span-6">
            <input type="checkbox" checked={draft.unassigned} onChange={(e) => setDraft((d) => ({ ...d, unassigned: e.target.checked, picker_id: '' }))} />
            Uniquement les sessions sans picker
          </label>
        )}
      </form>

      {/* Compteurs + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          {!isHistory ? (
            <>
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5">Ouvertes : <strong>{counts.open ?? 0}</strong></span>
              <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-800">En cours : <strong>{counts.in_progress ?? 0}</strong></span>
            </>
          ) : null}
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5">{pagination.total ?? 0} session(s)</span>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={load} title="Rafraîchir"><RefreshCw size={16} /></button>
          <button type="button" className="btn-secondary" onClick={handleExport} disabled={exporting}>
            <Download size={16} />{exporting ? 'Export…' : 'Exporter'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      <div className="table-wrap">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="table-th">Session</th>
                <th className="table-th">Commande</th>
                <th className="table-th">Node</th>
                <th className="table-th">Picker</th>
                <th className="table-th">Statut</th>
                {isHistory ? (
                  <>
                    <th className="table-th">Début → fin</th>
                    <th className="table-th text-right">Durée</th>
                    <th className="table-th text-right">Prélevé</th>
                    <th className="table-th text-right">Erreurs</th>
                    <th className="table-th">Performance</th>
                  </>
                ) : (
                  <>
                    <th className="table-th">Progression</th>
                    <th className="table-th">Créée / démarrée</th>
                    <th className="table-th text-right">Écoulé</th>
                    <th className="table-th text-right">Erreurs</th>
                  </>
                )}
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={11} className="table-td py-10 text-center text-slate-400">Chargement…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={11} className="table-td py-10 text-center text-slate-400">
                  {isHistory ? 'Aucune session clôturée sur cette période.' : 'Aucune session de préparation en cours.'}
                </td></tr>
              ) : rows.map((s) => {
                const m = s.metrics ?? {};
                const perf = performanceOf(m);
                return (
                  <tr key={s.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpen(s.id)}>
                    <td className="table-td font-mono text-xs font-semibold text-slate-800">{sessionRef(s.id)}</td>
                    <td className="table-td" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="font-mono text-xs font-semibold text-red-600 hover:underline" onClick={() => setOrderId(s.order_id)}>
                        {orderRef(s.order_id)}
                      </button>
                      <p className="max-w-[140px] truncate text-xs text-slate-500">{s.order?.customer?.name}</p>
                    </td>
                    <td className="table-td"><span className="font-mono text-xs font-semibold">{s.node?.code}</span></td>
                    <td className="table-td" onClick={(e) => e.stopPropagation()}>
                      {s.picker
                        ? <Link to={`/staff/pickers/${s.picker.id}`} className="text-sm text-slate-700 hover:text-red-600">{s.picker.name}</Link>
                        : <span className="text-xs font-semibold text-amber-600">Non assigné</span>}
                    </td>
                    <td className="table-td">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SESSION_STATUS_STYLE[s.status?.code] ?? 'bg-slate-100 text-slate-600'}`}>{s.status?.name_fr}</span>
                    </td>
                    {isHistory ? (
                      <>
                        <td className="table-td text-xs text-slate-500">{fmtDateTime(s.started_at)}<br />{fmtDateTime(s.completed_at)}</td>
                        <td className="table-td text-right text-sm">{fmtMinutes(m.duration_min)}</td>
                        <td className="table-td text-right text-sm">{fmtQty(m.qty_picked)}/{fmtQty(m.qty_expected)}{m.accuracy_pct != null ? <span className="block text-xs text-slate-400">{m.accuracy_pct} %</span> : null}</td>
                        <td className="table-td text-right">{s.error_count > 0 ? <span className="font-semibold text-rose-600">{s.error_count}</span> : <span className="text-slate-300">0</span>}</td>
                        <td className="table-td"><span className={`text-sm font-semibold ${perf.cls}`}>{perf.label}</span>{m.items_per_min ? <span className="block text-xs text-slate-400">{m.items_per_min} lignes/min</span> : null}</td>
                      </>
                    ) : (
                      <>
                        <td className="table-td min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-red-600" style={{ width: `${m.progress_pct ?? 0}%` }} />
                            </div>
                            <span className="text-xs text-slate-500">{m.items_processed ?? 0}/{m.items_total ?? 0}</span>
                          </div>
                        </td>
                        <td className="table-td text-xs text-slate-500">{fmtDateTime(s.created_at)}<br />{s.started_at ? fmtDateTime(s.started_at) : 'Non démarrée'}</td>
                        <td className="table-td text-right text-sm">{m.elapsed_min != null ? fmtMinutes(m.elapsed_min) : '—'}</td>
                        <td className="table-td text-right">{s.error_count > 0 ? <span className="inline-flex items-center gap-1 font-semibold text-rose-600"><AlertTriangle size={13} />{s.error_count}</span> : <span className="text-slate-300">0</span>}</td>
                      </>
                    )}
                    <td className="table-td text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {!isHistory && canReassign && (
                          <button type="button" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100" title={s.picker ? 'Réassigner picker' : 'Affecter un picker'} onClick={() => setReassign(s)}>
                            <UserCog size={16} />
                          </button>
                        )}
                        <button type="button" className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" title="Détail session & items" onClick={() => onOpen(s.id)}>
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Page {page} / {pagination.pages}</span>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Précédent</button>
            <button type="button" className="btn-secondary" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Suivant</button>
          </div>
        </div>
      )}
    </div>
  );
}
