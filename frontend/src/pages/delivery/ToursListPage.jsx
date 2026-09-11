import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, Plus, RefreshCw, Truck } from 'lucide-react';
import { assignDriver, getDeliveryMeta, getDrivers, getTour, getTours } from '../../api/deliveryMgmt.api';
import TourDetailPanel, { STOP_TONE, TOUR_TONE } from './TourDetailPanel';

// Tournées & Livreurs (WF #4, US-062 à US-065, US-019) — 4 onglets du classeur.
const TABS = [
  { key: 'list', label: 'Liste des tournées' },
  { key: 'detail', label: 'Détail tournée & arrêts' },
  { key: 'assign', label: 'Assignation livreur' },
  { key: 'live', label: 'Suivi en cours' },
];
const lc = (v) => String(v ?? '').toLowerCase();
const hhmm = (v) => (v ? new Date(v).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—');

function StatusPill({ status }) {
  return <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${TOUR_TONE[lc(status?.code)] || 'bg-gray-100 text-gray-600'}`}>{status?.name_fr || status?.code}</span>;
}

// ── Liste des tournées ───────────────────────────────────────────────────────
function ListTab({ meta, onOpen }) {
  const [filters, setFilters] = useState({ node_id: '', driver_id: '', date: '', status_code: '' });
  const [drivers, setDrivers] = useState([]);
  const [tours, setTours] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { getDrivers({ node_id: filters.node_id || undefined }).then((r) => setDrivers(r.data?.data || [])).catch(() => setDrivers([])); }, [filters.node_id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: 25 };
      for (const [k, v] of Object.entries(filters)) if (v) params[k] = v;
      const r = await getTours(params);
      setTours(r.data?.data || []);
      setPagination((p) => ({ ...p, ...(r.data?.pagination || {}) }));
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page]);

  useEffect(() => { load(); }, [load]);
  const setF = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPagination((p) => ({ ...p, page: 1 })); };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-6 py-3 text-sm">
        <select value={filters.node_id} onChange={(e) => setF('node_id', e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2">
          <option value="">Tous les nœuds</option>
          {(meta?.nodes || []).map((n) => <option key={n.id} value={n.id}>{n.name_fr}</option>)}
        </select>
        <select value={filters.driver_id} onChange={(e) => setF('driver_id', e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2">
          <option value="">Tous les livreurs</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input type="date" value={filters.date} onChange={(e) => setF('date', e.target.value)} className="rounded-lg border border-gray-200 px-3 py-1.5" aria-label="Date" />
        <select value={filters.status_code} onChange={(e) => setF('status_code', e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2">
          <option value="">Tous les statuts</option>
          {(meta?.statuses || []).map((s) => <option key={s.code} value={s.code}>{s.name_fr}</option>)}
        </select>
        <button type="button" onClick={load} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-gray-600 hover:bg-gray-50"><RefreshCw size={14} /> Rafraîchir</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="px-6 py-3 font-medium">Tournée</th>
              <th className="px-3 py-3 font-medium">Date / plage</th>
              <th className="px-3 py-3 font-medium">Livreur</th>
              <th className="px-3 py-3 font-medium">Nœud</th>
              <th className="px-3 py-3 font-medium">Arrêts</th>
              <th className="px-3 py-3 font-medium">Progression</th>
              <th className="px-3 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400">Chargement…</td></tr>}
            {!loading && tours.length === 0 && <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400">Aucune tournée ne correspond aux filtres.</td></tr>}
            {!loading && tours.map((t) => {
              const done = (t.stops || []).filter((s) => ['delivered', 'failed', 'skipped'].includes(lc(s.status?.code))).length;
              return (
                <tr key={t.id} onClick={() => onOpen(t.id)} className="cursor-pointer border-t border-gray-50 hover:bg-gray-50/60">
                  <td className="px-6 py-3 font-medium text-red-600">{t.id.slice(0, 8).toUpperCase()}{t.zone ? <span className="ml-1 text-xs text-gray-400">({t.zone})</span> : null}</td>
                  <td className="px-3 py-3 text-gray-600">{t.date || '—'}{t.slot_start ? ` · ${t.slot_start}–${t.slot_end || ''}` : ''}</td>
                  <td className="px-3 py-3">{t.driver?.name || <span className="text-amber-600">Non assigné</span>}</td>
                  <td className="px-3 py-3 text-gray-600">{t.node?.name_fr}</td>
                  <td className="px-3 py-3">{t.order_count}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{done}/{(t.stops || []).length}</td>
                  <td className="px-3 py-3"><StatusPill status={t.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3 text-sm text-gray-400">
        <span>{pagination.total} tournée(s)</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))} className="rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-30">◄</button>
          <span>{pagination.page}/{pagination.pages || 1}</span>
          <button type="button" disabled={pagination.page >= (pagination.pages || 1)} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))} className="rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-30">►</button>
        </div>
      </div>
    </div>
  );
}

// ── Détail tournée & arrêts (sélecteur + panneau) ────────────────────────────
function DetailTab({ tourId, onSelect }) {
  const [tours, setTours] = useState([]);
  useEffect(() => { getTours({ status_code: 'planned,in_progress', limit: 100 }).then((r) => setTours(r.data?.data || [])).catch(() => setTours([])); }, []);
  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-500">Tournée :</span>
        <select value={tourId || ''} onChange={(e) => onSelect(e.target.value || null)} className="min-w-[280px] rounded-lg border border-gray-200 px-3 py-2">
          <option value="">— Choisir une tournée planifiée ou en cours —</option>
          {tourId && !tours.some((t) => t.id === tourId) && <option value={tourId}>{tourId.slice(0, 8).toUpperCase()}</option>}
          {tours.map((t) => <option key={t.id} value={t.id}>{t.id.slice(0, 8).toUpperCase()} · {t.node?.name_fr} · {t.date || 'sans date'} · {t.driver?.name || 'sans livreur'} ({t.status?.name_fr})</option>)}
        </select>
        {tourId && <Link to={`/delivery/tours/${tourId}`} className="text-xs text-red-600 hover:underline">Ouvrir en pleine page</Link>}
      </div>
      {tourId ? <TourDetailPanel tourId={tourId} /> : <div className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-400">Sélectionnez une tournée (ou cliquez sur une ligne de la liste).</div>}
    </div>
  );
}

// ── Assignation livreur ──────────────────────────────────────────────────────
function AssignTab({ meta }) {
  const [nodeId, setNodeId] = useState('');
  const [availability, setAvailability] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [tours, setTours] = useState([]);
  const [choice, setChoice] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [d, t] = await Promise.all([
      getDrivers({ node_id: nodeId || undefined }).catch(() => null),
      getTours({ status_code: 'planned,in_progress', node_id: nodeId || undefined, limit: 100 }).catch(() => null),
    ]);
    setDrivers(d?.data?.data || []);
    setTours(t?.data?.data || []);
  }, [nodeId]);
  useEffect(() => { load(); }, [load]);

  const shownDrivers = drivers.filter((d) => (availability === 'available' ? d.is_available : availability === 'busy' ? !d.is_available : true));

  async function assign(tour) {
    const driverId = choice[tour.id];
    if (!driverId) return;
    setBusy(true);
    try {
      await assignDriver(tour.id, driverId);
      toast.success(tour.driver_id ? 'Livreur réassigné' : 'Livreur assigné');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Assignation impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-2">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <select value={nodeId} onChange={(e) => setNodeId(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2">
            <option value="">Tous les nœuds</option>
            {(meta?.nodes || []).map((n) => <option key={n.id} value={n.id}>{n.name_fr}</option>)}
          </select>
          <select value={availability} onChange={(e) => setAvailability(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2">
            <option value="">Toutes disponibilités</option>
            <option value="available">Disponibles</option>
            <option value="busy">En tournée</option>
          </select>
        </div>
        <h3 className="mb-2 text-sm font-semibold text-gray-800">Livreurs ({shownDrivers.length})</h3>
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {shownDrivers.length === 0 && <div className="p-4 text-center text-sm text-gray-400">Aucun livreur.</div>}
          {shownDrivers.map((d) => (
            <div key={d.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <div className="font-medium text-gray-800">{d.name}</div>
                <div className="text-xs text-gray-400">{d.node?.name_fr || '—'} · {d.phone_country}{d.phone_number}{d.vehicle_type ? ` · ${d.vehicle_type}` : ''}</div>
              </div>
              <div className="text-right text-xs">
                <span className={`rounded px-2 py-0.5 font-medium ${d.is_available ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{d.is_available ? 'Disponible' : 'En tournée'}</span>
                <div className="mt-0.5 text-gray-400">{d.tours_in_progress} en cours · {d.tours_planned} planifiée(s)</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-800">Tournées à assigner / réassigner ({tours.length})</h3>
        <div className="space-y-2">
          {tours.length === 0 && <div className="rounded-lg border border-dashed p-4 text-center text-sm text-gray-400">Aucune tournée planifiée ou en cours.</div>}
          {tours.map((t) => {
            const nodeDrivers = drivers.filter((d) => !t.node_id || d.node_id === t.node_id);
            return (
              <div key={t.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.id.slice(0, 8).toUpperCase()} · {t.node?.name_fr}</span>
                  <StatusPill status={t.status} />
                </div>
                <div className="text-xs text-gray-500">{t.date || 'sans date'}{t.slot_start ? ` · ${t.slot_start}–${t.slot_end || ''}` : ''} · {t.order_count} arrêt(s) · livreur : <strong>{t.driver?.name || 'non assigné'}</strong></div>
                <div className="mt-2 flex items-center gap-2">
                  <select value={choice[t.id] || ''} onChange={(e) => setChoice((c) => ({ ...c, [t.id]: e.target.value }))} className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm">
                    <option value="">— Choisir un livreur du nœud —</option>
                    {nodeDrivers.map((d) => <option key={d.id} value={d.id} disabled={d.id === t.driver_id}>{d.name}{d.is_available ? '' : ' (en tournée)'}</option>)}
                  </select>
                  <button type="button" disabled={busy || !choice[t.id]} onClick={() => assign(t)} className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40">{t.driver_id ? 'Réassigner' : 'Assigner'}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Suivi en cours ───────────────────────────────────────────────────────────
function LiveTab({ onOpen }) {
  const [tours, setTours] = useState([]);
  const [stopFilter, setStopFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getTours({ status_code: 'in_progress', limit: 50 });
      const list = r.data?.data || [];
      // progression détaillée (compteurs calculés par le détail)
      const detailed = await Promise.all(list.map((t) => getTour(t.id).then((x) => x.data?.data).catch(() => t)));
      setTours(detailed);
      setUpdatedAt(new Date());
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select value={stopFilter} onChange={(e) => setStopFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2">
          <option value="">Tous les statuts d'arrêt</option>
          <option value="pending">En attente</option>
          <option value="arrived">Arrivé</option>
          <option value="delivered">Livré</option>
          <option value="failed">Échec</option>
        </select>
        <button type="button" onClick={load} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-gray-600 hover:bg-gray-50">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Rafraîchir</button>
        {updatedAt && <span className="text-xs text-gray-400">Mis à jour à {hhmm(updatedAt)} — rafraîchissement automatique toutes les 30 s</span>}
      </div>
      {!loading && tours.length === 0 && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-400">Aucune tournée en cours.</div>}
      {tours.map((t) => {
        const p = t.progress || { total: t.stops?.length || 0, delivered: 0, failed: 0, pending: 0 };
        const pct = p.total ? Math.round(((p.delivered + p.failed) / p.total) * 100) : 0;
        const stops = (t.stops || []).filter((s) => !stopFilter || lc(s.status?.code) === stopFilter);
        return (
          <div key={t.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => onOpen(t.id)} className="flex items-center gap-2 font-semibold text-gray-900 hover:text-red-600"><Truck size={16} className="text-red-600" /> {t.id.slice(0, 8).toUpperCase()} · {t.driver?.name || 'sans livreur'} · {t.node?.name_fr}</button>
              <span className="text-xs text-gray-500">{p.delivered} livré(s) · {p.failed} échec(s) · {p.pending} restant(s)</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-gray-100"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
            <table className="mt-3 w-full text-xs">
              <thead><tr className="text-left text-gray-400"><th className="py-1">#</th><th>Commande</th><th>Client</th><th>Statut</th><th>Arrivée</th><th>Livraison</th><th>Motif d'échec</th></tr></thead>
              <tbody>
                {stops.map((s) => (
                  <tr key={s.id} className="border-t border-gray-50">
                    <td className="py-1.5">{s.sort_order}</td>
                    <td><Link to={`/orders-mgmt?order_id=${s.order_id}`} className="text-red-600 hover:underline">ORD-{s.order_id?.slice(0, 8).toUpperCase()}</Link></td>
                    <td>{s.order?.customer?.name}</td>
                    <td><span className={`rounded px-1.5 py-0.5 ${STOP_TONE[lc(s.status?.code)] || ''}`}>{s.status?.name_fr}</span></td>
                    <td>{hhmm(s.arrived_at)}</td>
                    <td>{hhmm(s.delivered_at)}</td>
                    <td className="text-rose-600">{s.failure_reason || ''}</td>
                  </tr>
                ))}
                {stops.length === 0 && <tr><td colSpan={7} className="py-2 text-center text-gray-400">Aucun arrêt pour ce filtre.</td></tr>}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

export default function ToursListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'list';
  const tourId = searchParams.get('tour_id');
  const [meta, setMeta] = useState(null);

  useEffect(() => { getDeliveryMeta().then((r) => setMeta(r.data?.data)).catch(() => setMeta(null)); }, []);

  const setTab = (key, extra = {}) => {
    const p = new URLSearchParams(searchParams);
    p.set('tab', key);
    for (const [k, v] of Object.entries(extra)) (v ? p.set(k, v) : p.delete(k));
    setSearchParams(p);
  };
  const openTour = useMemo(() => (id) => setTab('detail', { tour_id: id }), [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-5">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Tournées & Livreurs</h1>
            <p className="text-xs text-gray-500">Planifier les tournées, assigner les livreurs et suivre les arrêts.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/delivery/ready-orders" className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">Commandes prêtes</Link>
            <button type="button" onClick={() => navigate('/delivery/tours/new')} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><Plus size={15} /> Nouvelle tournée</button>
          </div>
        </div>
        <nav className="flex overflow-x-auto border-b border-gray-100 px-4">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`min-w-fit border-b-2 px-4 py-3 text-sm font-medium ${tab === t.key ? 'border-red-600 text-red-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >{t.label}</button>
          ))}
        </nav>
        {tab === 'list' && <ListTab meta={meta} onOpen={openTour} />}
        {tab === 'detail' && <DetailTab tourId={tourId} onSelect={(id) => setTab('detail', { tour_id: id })} />}
        {tab === 'assign' && <AssignTab meta={meta} />}
        {tab === 'live' && <LiveTab onOpen={openTour} />}
      </div>
    </div>
  );
}
