import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Loader2, Clock } from 'lucide-react';
import { getNodeSlots, createNodeSlot, updateSlot, deleteSlot } from '../../../api/locationNode.api';

const DAY_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const EMPTY_FORM = {
  name_fr: '',
  name_ar: '',
  day_of_week: '1',
  slot_start: '09:00',
  slot_end: '12:00',
  max_orders: '',
};

export default function NodeSlotsTab({ nodeId, canUpdate, showToast }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getNodeSlots(nodeId);
      setSlots(data.data || data || []);
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du chargement des créneaux');
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await createNodeSlot(nodeId, {
        name_fr: form.name_fr,
        name_ar: form.name_ar,
        day_of_week: Number(form.day_of_week),
        slot_start: form.slot_start,
        slot_end: form.slot_end,
        max_orders: form.max_orders === '' ? null : Number(form.max_orders),
      });
      showToast('success', 'Créneau ajouté');
      setForm(EMPTY_FORM);
      fetchSlots();
    } catch (err) {
      showToast('error', err?.response?.data?.message || "Erreur lors de l'ajout du créneau");
    } finally {
      setAdding(false);
    }
  };

  const toggleSlotActive = async (slot) => {
    setTogglingId(slot.id);
    try {
      await updateSlot(slot.id, { is_active: !slot.is_active });
      fetchSlots();
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (slot) => {
    setDeletingId(slot.id);
    try {
      await deleteSlot(slot.id);
      showToast('success', 'Créneau supprimé');
      fetchSlots();
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  const inputClass = "rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-sm outline-none focus:border-[#E10600] focus:ring-2 focus:ring-[#E10600]/15";

  return (
    <div>
      {canUpdate && (
        <form onSubmit={handleAdd} className="mb-5 space-y-2 rounded-lg border border-dashed border-neutral-200 p-3">
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[140px]">
              <label className="mb-1 block text-[11px] font-medium text-neutral-500">Nom (FR)</label>
              <input value={form.name_fr} onChange={setField('name_fr')} className={`${inputClass} w-full`} placeholder="Ex. Créneau matin" required />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="mb-1 block text-[11px] font-medium text-neutral-500">Nom (AR)</label>
              <input value={form.name_ar} onChange={setField('name_ar')} dir="rtl" className={`${inputClass} w-full`} required />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-500">Jour</label>
              <select value={form.day_of_week} onChange={setField('day_of_week')} className={inputClass}>
                {DAY_LABELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-500">Début</label>
              <input type="time" value={form.slot_start} onChange={setField('slot_start')} className={inputClass} required />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-500">Fin</label>
              <input type="time" value={form.slot_end} onChange={setField('slot_end')} className={inputClass} required />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-500">Commandes max</label>
              <input type="number" min="0" value={form.max_orders} onChange={setField('max_orders')} className={`${inputClass} w-28`} placeholder="Illimité" />
            </div>
            <button type="submit" disabled={adding}
              className="flex items-center gap-1.5 rounded-md bg-[#E10600] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#c00500] disabled:opacity-60">
              {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Ajouter
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-10 text-center"><Loader2 size={20} className="mx-auto animate-spin text-neutral-400" /></div>
      ) : slots.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-400">Aucun créneau configuré.</p>
      ) : (
        <div className="space-y-2">
          {slots.map((slot) => (
            <div key={slot.id} className="flex items-center justify-between rounded-lg border border-neutral-100 px-4 py-2.5">
              <div className="flex items-center gap-3">
                <Clock size={14} className="shrink-0 text-neutral-400" />
                <div>
                  <div className="text-sm font-medium text-neutral-800">{slot.name_fr}</div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <span>{DAY_LABELS[slot.day_of_week]}</span>
                    <span>·</span>
                    <span>{slot.slot_start} — {slot.slot_end}</span>
                    {slot.max_orders != null && (
                      <>
                        <span>·</span>
                        <span>Max {slot.max_orders}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {canUpdate && (
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleSlotActive(slot)} disabled={togglingId === slot.id}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition disabled:opacity-50 ${slot.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                    {togglingId === slot.id ? <Loader2 size={11} className="animate-spin" /> : slot.is_active ? 'Actif' : 'Inactif'}
                  </button>
                  <button onClick={() => handleDelete(slot)} disabled={deletingId === slot.id}
                    className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-[#E10600]">
                    {deletingId === slot.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}