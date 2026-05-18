import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getTour, getDrivers, assignDriver, startTour, completeTour, deliverStop, failStop, arriveStop } from '../../api/deliveryMgmt.api';

const fmtP = (v) => `${Number(v ?? 0).toFixed(2)} MAD`;
const STOP_COLOR = { pending: 'bg-gray-100 text-gray-600', arrived: 'bg-amber-100 text-amber-700', delivered: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700', skipped: 'bg-gray-100 text-gray-400' };

function StopCard({ stop, tour, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [form,     setForm]     = useState({ cod_collected: false, amount_collected: '', driver_notes: '', failure_reason: '', revert_to_ready: true });

  const order     = stop.order;
  const statusCode = stop.status?.code;
  const isCOD     = order?.payments?.[0]?.payment_method?.code === 'cod';
  const total      = Number(order?.total_ttc ?? 0);
  const canAct     = tour.status?.code === 'in_progress' && !['delivered', 'failed', 'skipped'].includes(statusCode);

  const action = async (fn, data, msg) => {
    setLoading(true);
    try {
      await fn(stop.id, data);
      toast.success(msg);
      setExpanded(false);
      onRefresh();
    } catch(e) { toast.error(e?.response?.data?.message ?? 'Erreur', { duration: 6000 }); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-gray-300 w-6 text-center">{stop.sort_order}</span>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{order?.customer?.name ?? '—'}</p>
            <p className="text-xs text-gray-400">{order?.customer?.phone_country} {order?.customer?.phone_number}</p>
            {order?.address && <p className="text-xs text-gray-500">📍 {order.address.street_name}, {order.address.city}</p>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STOP_COLOR[statusCode] ?? 'bg-gray-100 text-gray-600'}`}>{stop.status?.name_fr}</span>
          <p className="text-sm font-bold text-gray-900 mt-1">{fmtP(total)}</p>
          {isCOD && <p className="text-xs text-amber-600 font-semibold">💵 COD</p>}
        </div>
      </div>

      {canAct && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {!expanded ? (
            <div className="flex gap-2">
              {statusCode === 'pending' && (
                <button onClick={() => action(arriveStop, {}, 'Arrivé au client')}
                  disabled={loading}
                  className="flex-1 text-xs py-1.5 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50">
                  📍 Arrivé
                </button>
              )}
              <button onClick={() => setExpanded(true)}
                className="flex-1 text-xs py-1.5 border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50">
                Livrer / Échouer
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {isCOD && (
                <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <input type="checkbox" checked={form.cod_collected} onChange={e => setForm(f => ({ ...f, cod_collected: e.target.checked }))} className="accent-amber-600" />
                  <span className="text-xs text-amber-700 font-semibold">COD encaissé</span>
                  <input type="number" value={form.amount_collected} onChange={e => setForm(f => ({ ...f, amount_collected: e.target.value }))}
                    placeholder={total.toFixed(2)} className="border rounded px-2 py-1 text-xs w-24 ml-auto" />
                </div>
              )}
              <input type="text" value={form.driver_notes} onChange={e => setForm(f => ({ ...f, driver_notes: e.target.value }))}
                placeholder="Note chauffeur…" className="border rounded-lg px-2 py-1.5 text-xs w-full" />
              <div className="flex gap-2">
                <button disabled={loading || (isCOD && !form.cod_collected)}
                  onClick={() => action(deliverStop, {
                    cod_collected: form.cod_collected,
                    amount_collected: form.amount_collected ? Number(form.amount_collected) : total,
                    driver_notes: form.driver_notes,
                  }, 'Livraison confirmée ✓')}
                  className="flex-1 text-xs py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold">
                  ✓ Livré
                </button>
                <button disabled={loading}
                  onClick={() => {
                    const reason = prompt('Raison de l\'échec ?') || 'raison non précisée';
                    action(failStop, { failure_reason: reason, driver_notes: form.driver_notes, revert_to_ready: true }, 'Échec enregistré');
                  }}
                  className="flex-1 text-xs py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-semibold">
                  ✕ Échec
                </button>
                <button onClick={() => setExpanded(false)} className="text-xs px-3 py-2 text-gray-400 border border-gray-200 rounded-lg hover:bg-gray-50">✕</button>
              </div>
            </div>
          )}
        </div>
      )}

      {statusCode === 'delivered' && stop.delivered_at && (
        <p className="text-xs text-green-600 mt-2">✓ Livré {new Date(stop.delivered_at).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}{stop.cod_collected ? ` — COD ${fmtP(stop.amount_collected)}` : ''}</p>
      )}
      {statusCode === 'failed' && stop.failure_reason && (
        <p className="text-xs text-red-500 mt-2">✕ {stop.failure_reason}</p>
      )}
    </div>
  );
}

export default function TourDetailPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [tour,     setTour]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState(false);
  const [drivers,  setDrivers]  = useState([]);
  const [selDriver, setSelDriver] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getTour(id);
      setTour(r.data?.data);
    } catch { toast.error('Tournée introuvable'); navigate('/delivery/tours'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tour?.node_id) {
      getDrivers({ node_id: tour.node_id }).then(r => setDrivers(r.data?.data ?? [])).catch(() => {});
    }
  }, [tour?.node_id]);

  const doAction = async (fn, ...args) => {
    setActing(true);
    try { await fn(...args); await load(); }
    catch(e) { toast.error(e?.response?.data?.message ?? 'Erreur', { duration: 6000 }); }
    finally { setActing(false); }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">Chargement…</div>;
  if (!tour)   return null;

  const statusCode = tour.status?.code;
  const isPlanned  = statusCode === 'planned';
  const isRunning  = statusCode === 'in_progress';

  const TOUR_COLORS = { planned: 'bg-blue-100 text-blue-700', in_progress: 'bg-amber-100 text-amber-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/delivery/tours')} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
        <div>
          <p className="text-xs text-gray-400 font-mono">#{tour.id.slice(-8).toUpperCase()}</p>
          <h1 className="text-xl font-bold text-gray-900">
            {tour.node?.name_fr ?? '—'} {tour.zone ? `· ${tour.zone}` : ''}
          </h1>
        </div>
        <span className={`ml-auto px-3 py-1 rounded-full text-sm font-bold ${TOUR_COLORS[statusCode] ?? 'bg-gray-100 text-gray-600'}`}>
          {tour.status?.name_fr}
        </span>
      </div>

      {/* Info card */}
      <div className="bg-white rounded-2xl border shadow-sm p-5 mb-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-400 text-xs">Chauffeur</span><p className="font-semibold">{tour.driver?.name ?? '—'}</p></div>
          <div><span className="text-gray-400 text-xs">Date</span><p className="font-semibold">{tour.date ?? '—'} {tour.slot_start ? `${tour.slot_start}–${tour.slot_end}` : ''}</p></div>
          <div><span className="text-gray-400 text-xs">Stops</span><p className="font-semibold">{tour.stops?.length ?? 0}</p></div>
          <div><span className="text-gray-400 text-xs">Livrés</span><p className="font-semibold text-green-700">{tour.stops?.filter(s => s.status?.code === 'delivered').length ?? 0}</p></div>
        </div>
      </div>

      {/* Assign driver (planned) */}
      {isPlanned && !tour.driver && drivers.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4 flex gap-3 items-center">
          <select value={selDriver} onChange={e => setSelDriver(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">Choisir un chauffeur</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name} — {d.vehicle_plate ?? ''}</option>)}
          </select>
          <button disabled={!selDriver || acting}
            onClick={async () => {
              try { await assignDriver(tour.id, selDriver); toast.success('Chauffeur affecté'); load(); }
              catch(e) { toast.error(e?.response?.data?.message ?? 'Erreur'); }
            }}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            Affecter
          </button>
        </div>
      )}

      {/* Actions */}
      {isPlanned && (
        <button onClick={() => doAction(() => startTour(tour.id).then(() => toast.success('Tournée démarrée ✓')))}
          disabled={acting || !tour.stops?.length}
          className="w-full mb-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl">
          {acting ? '...' : `▶ Démarrer la tournée — ${tour.stops?.length ?? 0} stops`}
        </button>
      )}
      {isRunning && tour.stops?.every(s => ['delivered', 'failed', 'skipped'].includes(s.status?.code)) && (
        <button onClick={() => doAction(() => completeTour(tour.id).then(() => toast.success('Tournée terminée ✓')))}
          disabled={acting}
          className="w-full mb-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold rounded-xl">
          ✓ Terminer la tournée
        </button>
      )}

      {/* Stops */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Stops ({tour.stops?.length ?? 0})</h2>
        {tour.stops?.map(stop => (
          <StopCard key={stop.id} stop={stop} tour={tour} onRefresh={load} />
        ))}
      </div>
    </div>
  );
}
