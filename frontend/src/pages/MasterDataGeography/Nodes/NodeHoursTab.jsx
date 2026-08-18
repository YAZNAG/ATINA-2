import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { updateNode } from '../../../api/locationNode.api';

const DAYS = [
  { key: 'mon', label: 'Lundi' },
  { key: 'tue', label: 'Mardi' },
  { key: 'wed', label: 'Mercredi' },
  { key: 'thu', label: 'Jeudi' },
  { key: 'fri', label: 'Vendredi' },
  { key: 'sat', label: 'Samedi' },
  { key: 'sun', label: 'Dimanche' },
];

const DEFAULT_DAY = { closed: false, open: '08:00', close: '22:00' };

export default function NodeHoursTab({ node, canUpdate, onSaved, showToast }) {
  const [hours, setHours] = useState(() => {
    const base = {};
    DAYS.forEach(({ key }) => {
      base[key] = node.opening_hours_json?.[key] || { ...DEFAULT_DAY };
    });
    return base;
  });
  const [saving, setSaving] = useState(false);

  const setDay = (key, patch) => setHours((h) => ({ ...h, [key]: { ...h[key], ...patch } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateNode(node.id, { opening_hours_json: hours });
      showToast('success', 'Horaires mis à jour');
      onSaved();
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {DAYS.map(({ key, label }) => {
        const d = hours[key];
        return (
          <div key={key} className="flex items-center gap-4 rounded-lg border border-neutral-100 px-4 py-2.5">
            <span className="w-24 text-sm font-medium text-neutral-700">{label}</span>

            <label className="flex items-center gap-1.5 text-xs text-neutral-500">
              <input type="checkbox" checked={!d.closed} disabled={!canUpdate}
                onChange={(e) => setDay(key, { closed: !e.target.checked })}
                className="accent-[#E10600]" />
              Ouvert
            </label>

            {!d.closed ? (
              <div className="flex items-center gap-2">
                <input type="time" value={d.open} disabled={!canUpdate}
                  onChange={(e) => setDay(key, { open: e.target.value })}
                  className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm outline-none focus:border-[#E10600] disabled:opacity-60" />
                <span className="text-neutral-400">—</span>
                <input type="time" value={d.close} disabled={!canUpdate}
                  onChange={(e) => setDay(key, { close: e.target.value })}
                  className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm outline-none focus:border-[#E10600] disabled:opacity-60" />
              </div>
            ) : (
              <span className="text-xs text-neutral-400">Fermé</span>
            )}
          </div>
        );
      })}

      {canUpdate && (
        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c00500] disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Enregistrer
          </button>
        </div>
      )}
    </form>
  );
}