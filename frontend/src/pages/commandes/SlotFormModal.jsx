import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  createDeliverySlot, deleteDeliverySlot, getDeliverySlot, getDeliverySlots, patchDeliverySlot,
} from '../../api/orders.api';

// Panneau d'une journée : créneaux du nœud, capacité, réservations et préférences client (lecture seule).
const PREF_LABELS = { preferred: 'souhaitée(s)', confirmed: 'confirmée(s)', rejected: 'rejetée(s)', expired: 'expirée(s)' };
const EMPTY = { slot_start: '09:00', slot_end: '11:00', max_orders: '20', name_fr: '', name_ar: '' };

function SlotDetails({ slotId }) {
  const [data, setData] = useState(null);
  useEffect(() => { getDeliverySlot(slotId).then((r) => setData(r.data?.data)).catch(() => setData({ error: true })); }, [slotId]);
  if (!data) return <div className="py-2 text-xs text-gray-400">Chargement…</div>;
  if (data.error) return <div className="py-2 text-xs text-rose-600">Détail indisponible.</div>;
  return (
    <div className="mt-2 space-y-2 border-t border-gray-100 pt-2 text-xs">
      <div>
        <div className="font-semibold text-gray-600">Commandes confirmées sur ce créneau ({data.confirmed_orders.length})</div>
        {data.confirmed_orders.length === 0 ? <div className="text-gray-400">Aucune</div> : data.confirmed_orders.map((o) => (
          <div key={o.id} className="flex justify-between text-gray-600">
            <span>ORD-{o.id.slice(0, 8).toUpperCase()} — {o.customer?.name}</span>
            <span>{o.status?.name_fr} · {o.assignment_source?.name_fr || o.assignment_source?.code || '–'}</span>
          </div>
        ))}
      </div>
      <div>
        <div className="font-semibold text-gray-600">Préférences client ({data.preferences_list.length}) — lecture seule</div>
        {data.preferences_list.length === 0 ? <div className="text-gray-400">Aucune</div> : data.preferences_list.map((p) => (
          <div key={p.id} className="flex justify-between text-gray-600">
            <span>#{p.preference_order} ORD-{p.order?.id?.slice(0, 8).toUpperCase()} — {p.order?.customer?.name}</span>
            <span>{p.status?.name_fr || p.status?.code || 'souhaité'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SlotFormPanel({ nodeId, nodeLabel, dateKey, onClose, onChanged }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null); // { id, max_orders, name_fr, name_ar }
  const [open, setOpen] = useState(null);

  const prettyDate = new Date(`${dateKey}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const isPast = dateKey < new Date().toISOString().slice(0, 10);

  const load = useCallback(() => {
    setLoading(true);
    getDeliverySlots({ node_id: nodeId, date: dateKey, all: 'true' })
      .then((r) => setSlots(r.data?.data || []))
      .catch((err) => setError(err?.response?.data?.message || 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [nodeId, dateKey]);

  useEffect(() => { load(); }, [load]);

  async function act(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      load();
      onChanged?.();
      return true;
    } catch (err) {
      setError(err?.response?.data?.message || 'Action impossible');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    if (await act(() => createDeliverySlot({ node_id: nodeId, specific_date: dateKey, ...form, max_orders: Number(form.max_orders) }))) setForm(EMPTY);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold capitalize text-gray-900">{prettyDate}</h3>
            <span className="text-xs text-gray-500">{nodeLabel ? `Nœud ${nodeLabel}` : 'Nœud'} — {slots.length} créneau(x)</span>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100" aria-label="Fermer"><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
          {loading && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={14} className="animate-spin" /> Chargement…</div>}
          {!loading && slots.length === 0 && <div className="rounded-lg border border-dashed p-4 text-center text-sm text-gray-400">Aucun créneau ce jour.</div>}

          {slots.map((s) => {
            const pct = s.max_orders ? Math.min(100, (s.reservations / s.max_orders) * 100) : 100;
            const isEditing = editing?.id === s.id;
            const prefs = s.preferences || {};
            return (
              <div key={s.id} className={`rounded-lg border p-3 ${s.is_active ? 'border-gray-200' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{s.slot_start} à {s.slot_end} {!s.is_active && <span className="ml-1 rounded bg-gray-200 px-1.5 text-[10px] font-medium text-gray-500">Inactif</span>}</div>
                    {(s.name_fr || s.name_ar) && <div className="text-xs text-gray-500">{s.name_fr}{s.name_ar && <span dir="rtl" className="ml-2">{s.name_ar}</span>}</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-gray-500">
                      <input type="checkbox" checked={s.is_active} disabled={busy} onChange={() => act(() => patchDeliverySlot(s.id, { is_active: !s.is_active }))} />
                      {s.is_active ? 'Actif' : 'Inactif'}
                    </label>
                    <button type="button" onClick={() => setEditing(isEditing ? null : { id: s.id, max_orders: String(s.max_orders), name_fr: s.name_fr || '', name_ar: s.name_ar || '' })} className="rounded p-1 text-gray-400 hover:text-red-600" aria-label="Modifier"><Pencil size={14} /></button>
                    <button type="button" disabled={busy} onClick={() => { if (window.confirm('Supprimer ce créneau ? (impossible s\'il est lié à une commande ou préférence : désactivez-le)')) act(() => deleteDeliverySlot(s.id)); }} className="rounded p-1 text-gray-400 hover:text-red-600" aria-label="Supprimer"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                  <span>Capacité {s.max_orders} · Réservations <strong>{s.reservations}</strong> · Restantes {s.remaining ?? '–'}{s.is_full ? <span className="ml-1 text-rose-600">(complet)</span> : null}</span>
                  <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} className="inline-flex items-center gap-0.5 text-red-600">Détail {open === s.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</button>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-gray-100"><div className={`h-full ${s.is_full ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} /></div>
                <div className="mt-1 text-[11px] text-gray-500">
                  Préférences client : {prefs.total || 0}
                  {prefs.total ? ` (${Object.entries(PREF_LABELS).filter(([k]) => prefs[k]).map(([k, l]) => `${prefs[k]} ${l}`).join(', ')})` : ''}
                </div>
                {isEditing && (
                  <div className="mt-2 flex flex-wrap items-end gap-2 rounded-md bg-gray-50 p-2 text-xs">
                    <label>Capacité max<input type="number" min={0} value={editing.max_orders} onChange={(e) => setEditing({ ...editing, max_orders: e.target.value })} className="mt-0.5 block w-20 rounded border border-gray-200 px-2 py-1" /></label>
                    <label>Nom FR<input value={editing.name_fr} onChange={(e) => setEditing({ ...editing, name_fr: e.target.value })} className="mt-0.5 block w-28 rounded border border-gray-200 px-2 py-1" /></label>
                    <label>Nom AR<input dir="rtl" value={editing.name_ar} onChange={(e) => setEditing({ ...editing, name_ar: e.target.value })} className="mt-0.5 block w-28 rounded border border-gray-200 px-2 py-1" /></label>
                    <button type="button" disabled={busy} onClick={async () => { if (await act(() => patchDeliverySlot(s.id, { max_orders: Number(editing.max_orders), name_fr: editing.name_fr, name_ar: editing.name_ar }))) setEditing(null); }} className="rounded bg-red-600 px-3 py-1.5 font-medium text-white disabled:opacity-50">Enregistrer</button>
                  </div>
                )}
                {open === s.id && <SlotDetails slotId={s.id} />}
              </div>
            );
          })}

          {!isPast && (
            <form onSubmit={handleCreate} className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
              <div className="text-sm font-semibold text-gray-700">Ajouter un créneau</div>
              <div className="flex flex-wrap items-end gap-2">
                <label>Début<input type="time" required value={form.slot_start} onChange={(e) => setForm({ ...form, slot_start: e.target.value })} className="mt-0.5 block rounded border border-gray-200 px-2 py-1" /></label>
                <label>Fin<input type="time" required value={form.slot_end} onChange={(e) => setForm({ ...form, slot_end: e.target.value })} className="mt-0.5 block rounded border border-gray-200 px-2 py-1" /></label>
                <label>Capacité max<input type="number" min={0} required value={form.max_orders} onChange={(e) => setForm({ ...form, max_orders: e.target.value })} className="mt-0.5 block w-20 rounded border border-gray-200 px-2 py-1" /></label>
                <label>Nom FR<input value={form.name_fr} onChange={(e) => setForm({ ...form, name_fr: e.target.value })} placeholder="Optionnel" className="mt-0.5 block w-28 rounded border border-gray-200 px-2 py-1" /></label>
                <label>Nom AR<input dir="rtl" value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} placeholder="اختياري" className="mt-0.5 block w-28 rounded border border-gray-200 px-2 py-1" /></label>
              </div>
              <button type="submit" disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"><Plus size={14} /> Ajouter le créneau</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
