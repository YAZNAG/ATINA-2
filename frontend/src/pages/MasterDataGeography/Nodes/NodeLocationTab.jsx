import { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import { updateNode, getRegions } from '../../../api/locationNode.api';
import { useCascadeGeo } from './useCascadeGeo';

export default function NodeLocationTab({ node, canUpdate, onSaved, showToast }) {
  const [form, setForm] = useState({
    region_id: node.region_id || '',
    city_id: node.city_id || '',
    address_line1: node.address_line1 || '',
    quartier: node.quartier || '',
    postal_code: node.postal_code || '',
    lat: node.lat ?? '',
    lng: node.lng ?? '',
  });
  const [saving, setSaving] = useState(false);

  const [allRegions, setAllRegions] = useState([]);
  const [loadingRegions, setLoadingRegions] = useState(true);

  useEffect(() => {
    getRegions({ limit: 500, is_active: true })
      .then(({ data }) => setAllRegions(data.data || data || []))
      .catch(() => {})
      .finally(() => setLoadingRegions(false));
  }, []);

  const { cities } = useCascadeGeo({
    regionId: form.region_id,
    onCityReset: () => setForm((f) => ({ ...f, city_id: '' })),
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateNode(node.id, form);
      showToast('success', 'Localisation mise à jour');
      onSaved();
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none transition focus:border-[#E10600] focus:bg-white focus:ring-2 focus:ring-[#E10600]/15 disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Région</label>
        <select value={form.region_id} onChange={set('region_id')} disabled={!canUpdate || loadingRegions} className={inputClass} required>
          <option value="">{loadingRegions ? 'Chargement…' : 'Sélectionner…'}</option>
          {allRegions.map((r) => <option key={r.id} value={r.id}>{r.name_fr}</option>)}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Ville</label>
        <select value={form.city_id} onChange={set('city_id')} disabled={!canUpdate || !form.region_id} className={inputClass} required>
          <option value="">Sélectionner…</option>
          {cities.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
        </select>
      </div>

      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-neutral-500">Adresse</label>
        <input value={form.address_line1} onChange={set('address_line1')} disabled={!canUpdate} className={inputClass} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Quartier</label>
        <input value={form.quartier} onChange={set('quartier')} disabled={!canUpdate} className={inputClass} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Code postal</label>
        <input value={form.postal_code} onChange={set('postal_code')} disabled={!canUpdate} className={inputClass} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Latitude</label>
        <input type="number" step="0.0000001" value={form.lat} onChange={set('lat')} disabled={!canUpdate} className={inputClass} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Longitude</label>
        <input type="number" step="0.0000001" value={form.lng} onChange={set('lng')} disabled={!canUpdate} className={inputClass} />
      </div>

      {canUpdate && (
        <div className="sm:col-span-3 flex justify-end pt-2">
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