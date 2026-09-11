import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowUp, Ban, Check, Loader2, MapPin, Pencil, Play, Plus, RefreshCw, Trash2, Truck, X } from 'lucide-react';
import {
  addOrders, arriveStop, assignDriver, cancelTour, completeTour, deliverStop, failStop, getDrivers,
  getReadyHomeOrders, getTour, removeStop, reorderStops, startTour, updateTour,
} from '../../api/deliveryMgmt.api';

// Détail d'une tournée & de ses arrêts ordonnés (WF #4, US-062 à US-065).
export const TOUR_TONE = {
  planned: 'bg-blue-50 text-blue-700', in_progress: 'bg-amber-50 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-700', cancelled: 'bg-gray-100 text-gray-500',
};
export const STOP_TONE = {
  pending: 'bg-gray-100 text-gray-600', arrived: 'bg-blue-50 text-blue-700', in_progress: 'bg-blue-50 text-blue-700',
  delivered: 'bg-emerald-50 text-emerald-700', failed: 'bg-rose-50 text-rose-600', skipped: 'bg-gray-100 text-gray-500',
};
const DONE = ['delivered', 'failed', 'skipped'];
const lc = (v) => String(v ?? '').toLowerCase();
const money = (v) => `${Number(v ?? 0).toFixed(2)} MAD`;
const hhmm = (v) => (v ? new Date(v).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—');
const errMsg = (e, f) => e?.response?.data?.message || f;

function addressLabel(a) {
  if (!a) return 'Adresse inconnue';
  return [[a.street_number, a.street_name].filter(Boolean).join(' '), a.quartier, a.city].filter(Boolean).join(', ');
}

function StopRow({ stop, index, total, tourStatus, busy, onMove, onRemove, onAction }) {
  const code = lc(stop.status?.code);
  const order = stop.order;
  const pay = order?.payments?.[0];
  const isCod = lc(pay?.payment_method?.code) === 'cod';
  const collected = lc(pay?.status?.code) === 'collected';
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const planned = tourStatus === 'planned';
  const running = tourStatus === 'in_progress';
  const movable = planned || (running && !DONE.includes(code));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-0.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">{stop.sort_order}</span>
          {movable && (
            <>
              <button type="button" disabled={busy || index === 0} onClick={() => onMove(index, -1)} className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Monter"><ArrowUp size={13} /></button>
              <button type="button" disabled={busy || index === total - 1} onClick={() => onMove(index, 1)} className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Descendre"><ArrowDown size={13} /></button>
            </>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link to={`/orders-mgmt?order_id=${order?.id}`} className="font-medium text-red-600 hover:underline">ORD-{order?.id?.slice(0, 8).toUpperCase()}</Link>
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STOP_TONE[code] || 'bg-gray-100 text-gray-600'}`}>{stop.status?.name_fr || code}</span>
          </div>
          <div className="text-sm text-gray-700">{order?.customer?.name} <span className="text-xs text-gray-400">{order?.customer?.phone_country}{order?.customer?.phone_number}</span></div>
          <div className="flex items-center gap-1 text-xs text-gray-500"><MapPin size={11} /> {addressLabel(order?.address)}</div>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
            <span>Commande : {order?.status?.name_fr}</span>
            <span>{money(order?.total_ttc)} {isCod ? (collected ? '· COD encaissé' : '· COD à encaisser') : ''}</span>
            {order?.confirmed_slot && <span>Créneau {order.confirmed_slot.slot_start}–{order.confirmed_slot.slot_end}</span>}
            <span>Arrivée {hhmm(stop.arrived_at)}</span>
            <span>Livraison {hhmm(stop.delivered_at)}</span>
          </div>
          {stop.failure_reason && <div className="mt-1 text-xs text-rose-600">Motif d'échec : {stop.failure_reason}</div>}
          {stop.driver_notes && <div className="mt-1 text-xs text-gray-500">Notes livreur : {stop.driver_notes}</div>}

          {running && !DONE.includes(code) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {code !== 'arrived' && <button type="button" disabled={busy} onClick={() => onAction(() => arriveStop(stop.id, {}), 'Arrivée enregistrée')} className="rounded-md border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50">Arrivé</button>}
              <button type="button" disabled={busy} onClick={() => setDeliverOpen((v) => !v)} className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700">Livrer</button>
              <button type="button" disabled={busy} onClick={() => {
                const reason = window.prompt("Motif de l'échec de livraison (obligatoire) :");
                if (reason && reason.trim()) onAction(() => failStop(stop.id, { failure_reason: reason.trim(), revert_to_ready: true }), 'Échec enregistré — commande remise à « prête »');
              }} className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">Échec</button>
            </div>
          )}
          {deliverOpen && (
            <div className="mt-2 flex flex-wrap items-end gap-2 rounded-md bg-gray-50 p-2 text-xs">
              {isCod && !collected && (
                <label>Montant encaissé (MAD)<input type="number" value={amount} placeholder={Number(order?.total_ttc).toFixed(2)} onChange={(e) => setAmount(e.target.value)} className="mt-0.5 block w-28 rounded border border-gray-200 px-2 py-1" /></label>
              )}
              <button type="button" disabled={busy} onClick={() => onAction(() => deliverStop(stop.id, isCod && !collected ? { cod_collected: true, amount_collected: amount ? Number(amount) : Number(order?.total_ttc) } : {}), 'Arrêt livré')} className="rounded bg-emerald-600 px-3 py-1.5 font-medium text-white">
                Confirmer la livraison{isCod && !collected ? ' et l\'encaissement' : ''}
              </button>
            </div>
          )}
        </div>
        {planned && (
          <button type="button" disabled={busy} onClick={() => onRemove(stop)} className="rounded p-1 text-gray-400 hover:text-red-600" aria-label="Retirer l'arrêt"><Trash2 size={15} /></button>
        )}
      </div>
    </div>
  );
}

export default function TourDetailPanel({ tourId, onChanged, autoRefresh = false }) {
  const [tour, setTour] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [ready, setReady] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [toAdd, setToAdd] = useState([]);
  const [driverId, setDriverId] = useState('');
  const [editInfo, setEditInfo] = useState(null); // { date, slot_start, slot_end, zone, notes }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!tourId) return;
    try {
      const t = (await getTour(tourId)).data?.data;
      setTour(t);
      setDriverId(t?.driver_id || '');
      setError(null);
    } catch (e) {
      setError(errMsg(e, 'Tournée introuvable'));
    }
  }, [tourId]);

  useEffect(() => { setTour(null); load(); }, [load]);
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  useEffect(() => {
    if (!tour?.node_id) return;
    getDrivers({ node_id: tour.node_id }).then((r) => setDrivers(r.data?.data || [])).catch(() => setDrivers([]));
  }, [tour?.node_id]);

  useEffect(() => {
    if (!addOpen || !tour?.node_id) return;
    getReadyHomeOrders({ node_id: tour.node_id }).then((r) => setReady(r.data?.data || [])).catch(() => setReady([]));
  }, [addOpen, tour?.node_id]);

  async function run(fn, msg) {
    setBusy(true);
    try {
      await fn();
      if (msg) toast.success(msg);
      await load();
      onChanged?.();
      return true;
    } catch (e) {
      toast.error(errMsg(e, 'Action impossible'), { duration: 6000 });
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>;
  if (!tour) return <div className="flex items-center gap-2 p-6 text-sm text-gray-500"><Loader2 size={15} className="animate-spin" /> Chargement…</div>;

  const status = lc(tour.status?.code);
  const stops = tour.stops || [];
  const p = tour.progress || { total: stops.length, delivered: 0, failed: 0, pending: stops.length };
  const pct = p.total ? Math.round(((p.delivered + p.failed) / p.total) * 100) : 0;

  const move = (index, delta) => {
    const ids = stops.map((s) => s.id);
    const j = index + delta;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    run(() => reorderStops(tour.id, ids), 'Ordre des arrêts enregistré');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Truck size={18} className="text-red-600" />
              <span className="text-lg font-semibold text-gray-900">Tournée {tour.id.slice(0, 8).toUpperCase()}</span>
              <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${TOUR_TONE[status] || 'bg-gray-100'}`}>{tour.status?.name_fr}</span>
            </div>
            <div className="mt-1 text-sm text-gray-500">
              {tour.node?.name_fr} · {tour.date || 'Date non fixée'}{tour.slot_start ? ` · ${tour.slot_start}–${tour.slot_end || ''}` : ''}{tour.zone ? ` · Zone ${tour.zone}` : ''}
            </div>
            <div className="text-sm text-gray-500">Livreur : <strong className="text-gray-800">{tour.driver?.name || 'non assigné'}</strong> · {tour.order_count} arrêt(s)</div>
            {tour.notes && <div className="text-xs text-gray-500">Notes : {tour.notes}</div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={load} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"><RefreshCw size={13} /> Rafraîchir</button>
            {!['completed', 'cancelled'].includes(status) && <button type="button" onClick={() => setEditInfo(editInfo ? null : { date: tour.date || '', slot_start: tour.slot_start || '', slot_end: tour.slot_end || '', zone: tour.zone || '', notes: tour.notes || '' })} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"><Pencil size={13} /> Modifier</button>}
            {status === 'planned' && <button type="button" disabled={busy} onClick={() => run(() => startTour(tour.id), 'Tournée démarrée')} className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"><Play size={13} /> Démarrer</button>}
            {status === 'in_progress' && <button type="button" disabled={busy} onClick={() => { if (window.confirm('Clôturer la tournée ?')) run(() => completeTour(tour.id), 'Tournée clôturée'); }} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"><Check size={13} /> Clôturer la tournée</button>}
            {status === 'planned' && <button type="button" disabled={busy} onClick={() => { const r = window.prompt("Motif d'annulation de la tournée :"); if (r !== null) run(() => cancelTour(tour.id, r), 'Tournée annulée'); }} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"><Ban size={13} /> Annuler</button>}
          </div>
        </div>
        {editInfo && (
          <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md bg-gray-50 p-3 text-xs">
            <label>Date<input type="date" value={editInfo.date} onChange={(e) => setEditInfo({ ...editInfo, date: e.target.value })} className="mt-0.5 block rounded border border-gray-200 px-2 py-1" /></label>
            <label>Début<input type="time" value={editInfo.slot_start} onChange={(e) => setEditInfo({ ...editInfo, slot_start: e.target.value })} className="mt-0.5 block rounded border border-gray-200 px-2 py-1" /></label>
            <label>Fin<input type="time" value={editInfo.slot_end} onChange={(e) => setEditInfo({ ...editInfo, slot_end: e.target.value })} className="mt-0.5 block rounded border border-gray-200 px-2 py-1" /></label>
            <label>Zone<input value={editInfo.zone} onChange={(e) => setEditInfo({ ...editInfo, zone: e.target.value })} className="mt-0.5 block w-28 rounded border border-gray-200 px-2 py-1" /></label>
            <label className="flex-1">Notes<input value={editInfo.notes} onChange={(e) => setEditInfo({ ...editInfo, notes: e.target.value })} className="mt-0.5 block w-full rounded border border-gray-200 px-2 py-1" /></label>
            <button type="button" disabled={busy} onClick={async () => { if (await run(() => updateTour(tour.id, editInfo), 'Tournée mise à jour')) setEditInfo(null); }} className="rounded bg-red-600 px-3 py-1.5 font-medium text-white disabled:opacity-50">Enregistrer</button>
          </div>
        )}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500"><span>Progression : {p.delivered} livré(s), {p.failed} échec(s), {p.pending} restant(s)</span><span>{pct}%</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded bg-gray-100"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
        </div>
        {!['completed', 'cancelled'].includes(status) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-sm">
            <span className="text-xs text-gray-500">{tour.driver_id ? 'Réassigner le livreur' : 'Assigner un livreur'} :</span>
            <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="rounded-md border border-gray-200 px-2 py-1 text-sm">
              <option value="">—</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}{d.is_available ? '' : ' (en tournée)'} · {d.tours_planned} planifiée(s)</option>)}
            </select>
            <button type="button" disabled={busy || !driverId || driverId === tour.driver_id} onClick={() => run(() => assignDriver(tour.id, driverId), tour.driver_id ? 'Livreur réassigné' : 'Livreur assigné')} className="rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-40">{tour.driver_id ? 'Réassigner' : 'Assigner'}</button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Arrêts ordonnés ({stops.length})</h3>
        {status === 'planned' && <button type="button" onClick={() => { setAddOpen((v) => !v); setToAdd([]); }} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline">{addOpen ? <><X size={12} /> Fermer</> : <><Plus size={12} /> Ajouter un arrêt</>}</button>}
      </div>

      {addOpen && (
        <div className="rounded-lg border border-red-100 bg-red-50/40 p-3">
          <div className="mb-2 text-xs text-gray-600">Commandes prêtes, livraison à domicile, même nœud, sans tournée :</div>
          {ready.length === 0 ? <div className="text-xs text-gray-400">Aucune commande disponible.</div> : (
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {ready.map((o) => (
                <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded bg-white px-2 py-1.5 text-xs">
                  <input type="checkbox" checked={toAdd.includes(o.id)} onChange={() => setToAdd((prev) => (prev.includes(o.id) ? prev.filter((x) => x !== o.id) : [...prev, o.id]))} />
                  <span className="font-medium">ORD-{o.id.slice(0, 8).toUpperCase()}</span>
                  <span>{o.customer?.name}</span>
                  <span className="text-gray-400">{addressLabel(o.address)}</span>
                  {o.confirmed_slot && <span className="ml-auto text-gray-500">{o.confirmed_slot.slot_start}–{o.confirmed_slot.slot_end}</span>}
                </label>
              ))}
            </div>
          )}
          <button type="button" disabled={busy || !toAdd.length} onClick={async () => { if (await run(() => addOrders(tour.id, toAdd), 'Arrêt(s) ajouté(s)')) { setAddOpen(false); setToAdd([]); } }} className="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Ajouter {toAdd.length || ''} arrêt(s)</button>
        </div>
      )}

      {stops.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-400">Aucun arrêt dans cette tournée.</div> : (
        <div className="space-y-2">
          {stops.map((s, i) => (
            <StopRow key={s.id} stop={s} index={i} total={stops.length} tourStatus={status} busy={busy}
              onMove={move}
              onRemove={(stop) => { if (window.confirm("Retirer cet arrêt de la tournée ? La commande redevient disponible.")) run(() => removeStop(tour.id, stop.id), 'Arrêt retiré'); }}
              onAction={(fn, msg) => run(fn, msg)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
