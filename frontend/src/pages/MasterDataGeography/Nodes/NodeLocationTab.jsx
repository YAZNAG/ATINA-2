import { useState, useEffect } from 'react';
import { Loader2, Save, MousePointerClick } from 'lucide-react';
import { updateNode, getRegions } from '../../../api/locationNode.api';
import { useCascadeGeo } from './useCascadeGeo';
import NodeMap from './NodeMap';

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
    getRegions({ limit: 500, is_active: true, is_deleted: false })
      .then(({ data }) => setAllRegions(data.data || data || []))
      .catch(() => {})
      .finally(() => setLoadingRegions(false));
  }, []);

  const { cities } = useCascadeGeo({
    regionId: form.region_id,
    onCityReset: () => setForm((f) => ({ ...f, city_id: '' })),
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Changer de région remet la ville à zéro (la liste des villes est filtrée par région).
  const setRegion = (e) => setForm((f) => ({ ...f, region_id: e.target.value, city_id: '' }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.city_id) {
      showToast('error', 'La ville est obligatoire');
      return;
    }
    setSaving(true);
    try {
      await updateNode(node.id, {
        ...form,
        lat: form.lat === '' ? null : Number(form.lat),
        lng: form.lng === '' ? null : Number(form.lng),
      });
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">Région *</label>
          <select value={form.region_id} onChange={setRegion} disabled={!canUpdate || loadingRegions} className={inputClass} required>
            <option value="">{loadingRegions ? 'Chargement…' : 'Sélectionner…'}</option>
            {allRegions.map((r) => <option key={r.id} value={r.id}>{r.name_fr}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">Ville *</label>
          <select value={form.city_id} onChange={set('city_id')} disabled={!canUpdate || !form.region_id} className={inputClass} required>
            <option value="">Sélectionner…</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
            {node.city && !cities.some((c) => c.id === node.city_id) && form.city_id === node.city_id && (
              <option value={node.city_id}>{node.city.name_fr} (inactive)</option>
            )}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">Code postal</label>
          <input value={form.postal_code} onChange={set('postal_code')} disabled={!canUpdate} className={inputClass} />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-neutral-500">Adresse (rue)</label>
          <input value={form.address_line1} onChange={set('address_line1')} disabled={!canUpdate} className={inputClass} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">Quartier</label>
          <input value={form.quartier} onChange={set('quartier')} disabled={!canUpdate} className={inputClass} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">Latitude</label>
          <input type="number" step="any" min="-90" max="90" value={form.lat} onChange={set('lat')} disabled={!canUpdate} className={inputClass} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">Longitude</label>
          <input type="number" step="any" min="-180" max="180" value={form.lng} onChange={set('lng')} disabled={!canUpdate} className={inputClass} />
        </div>
      </div>

      <div>
        {canUpdate && (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-neutral-500">
            <MousePointerClick size={14} /> Cliquez sur la carte pour placer le pin du node (ou saisissez la latitude / longitude).
          </p>
        )}
        <NodeMap
          lat={form.lat}
          lng={form.lng}
          radiusKm={node.delivery_radius_km}
          label={node.name_fr}
          height={340}
          onPick={canUpdate ? ({ lat, lng }) => setForm((f) => ({ ...f, lat, lng })) : undefined}
        />
      </div>

      {canUpdate && (
        <div className="flex justify-end">
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
