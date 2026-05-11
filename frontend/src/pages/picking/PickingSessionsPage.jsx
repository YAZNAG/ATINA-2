import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getPickingSessions, createPickingSession } from '../../api/picking.api';
import { getOrders } from '../../api/orders_mgmt.api';
import { getErrorMessage, formatDate } from '../../utils/helpers';

const SVG = {
  plus:    'M12 4v16m8-8H4',
  search:  'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  box:     'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  user:    'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  node:    'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4',
  clock:   'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  check:   'M5 13l4 4L19 7',
  warn:    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  order:   'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

const STATUS_STYLE = {
  open:        { bg: 'bg-gray-100 text-gray-700',    dot: 'bg-gray-400'    },
  in_progress: { bg: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500'   },
  completed:   { bg: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  cancelled:   { bg: 'bg-red-100 text-red-700',      dot: 'bg-red-500'     },
};

function StatusBadge({ status }) {
  if (!status) return null;
  const s = STATUS_STYLE[status.code] ?? STATUS_STYLE.open;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status.name_fr}
    </span>
  );
}

function elapsed(d) {
  if (!d) return '—';
  const mins = Math.floor((Date.now() - new Date(d)) / 60000);
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
}

export default function PickingSessionsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 25, ...(statusFilter && { status_code: statusFilter }) };
      const r = await getPickingSessions(params);
      setSessions(r.data?.data ?? []);
      const pg = r.data?.pagination;
      if (pg) { setTotal(pg.total ?? 0); setTotalPages(pg.pages ?? 0); }
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const loadPendingOrders = async () => {
    try {
      const r = await getOrders({ status_code: 'picking', limit: 50 });
      setPendingOrders(r.data?.data ?? []);
    } catch { /* ignore */ }
  };

  const handleCreate = async () => {
    if (!selectedOrder) return toast.error('Sélectionnez une commande');
    setCreating(true);
    try {
      await createPickingSession({ order_id: selectedOrder });
      toast.success('Session picking créée');
      setShowCreate(false); setSelectedOrder('');
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setCreating(false); }
  };

  const STATUS_TABS = [
    { code: '', label: 'Toutes' },
    { code: 'open',        label: 'Ouvertes'   },
    { code: 'in_progress', label: 'En cours'   },
    { code: 'completed',   label: 'Terminées'  },
    { code: 'cancelled',   label: 'Annulées'   },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <span>Picking</span><span>›</span>
                <span className="text-violet-600 font-medium">Sessions</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Sessions Picking</h1>
              <p className="text-sm text-gray-400 mt-0.5">Préparation des commandes par node</p>
            </div>
            <button onClick={() => { setShowCreate(true); loadPendingOrders(); }}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm flex-shrink-0">
              <Icon d={SVG.plus} className="w-4 h-4" />Nouvelle session
            </button>
          </div>

          {/* Status tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {STATUS_TABS.map(t => (
              <button key={t.code} onClick={() => { setStatusFilter(t.code); setPage(1); }}
                className={`px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                  statusFilter === t.code ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}>{t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Créer une session picking</h3>
            <p className="text-sm text-gray-500 mb-3">Sélectionnez une commande en statut "Picking"</p>
            <select value={selectedOrder} onChange={e => setSelectedOrder(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 mb-4">
              <option value="">— Sélectionner une commande —</option>
              {pendingOrders.map(o => (
                <option key={o.id} value={o.id}>
                  ORD-{o.id.slice(0,8).toUpperCase()} · {o.customer?.name} · {Number(o.total_ttc).toFixed(2)} MAD
                </option>
              ))}
              {pendingOrders.length === 0 && <option disabled>Aucune commande en cours de picking</option>}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">Annuler</button>
              <button onClick={handleCreate} disabled={creating || !selectedOrder}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50">
                {creating ? 'Création…' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-24"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center">
              <Icon d={SVG.box} className="w-10 h-10 text-violet-200" />
            </div>
            <p className="text-gray-600 font-semibold">Aucune session picking</p>
            <p className="text-gray-400 text-sm">Les sessions sont créées automatiquement quand une commande passe au statut "Picking"</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Session</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Commande</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Node</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Picker</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Articles</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Durée</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sessions.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors group cursor-pointer" onClick={() => navigate(`/picking/sessions/${s.id}`)}>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs font-bold text-violet-600">PSK-{s.id.slice(0,8).toUpperCase()}</span>
                        <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(s.created_at)}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-mono text-xs font-semibold text-blue-600">ORD-{s.order_id?.slice(0,8).toUpperCase()}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[120px]">{s.order?.customer?.name}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-mono font-semibold text-gray-700">{s.node?.code}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        {s.picker ? (
                          <span className="text-xs text-gray-700">{s.picker.name}</span>
                        ) : (
                          <span className="text-xs text-amber-500 font-semibold">Non assigné</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-sm font-bold text-gray-700">{s._count?.items ?? 0}</span>
                      </td>
                      <td className="px-4 py-3.5"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3.5 text-right text-xs text-gray-500">
                        {s.started_at ? elapsed(s.started_at) : '—'}
                        {s.error_count > 0 && <span className="ml-1 text-red-500 font-semibold">{s.error_count}⚠</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-xs text-violet-600 font-semibold opacity-0 group-hover:opacity-100">Ouvrir →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-gray-400">Page {page}/{totalPages} · {total} sessions</p>
                <div className="flex gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">←</button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">→</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
