import { useEffect, useState } from 'react';
import { Loader2, MapPin, Save, Radius, Info } from 'lucide-react';
import { updateNode, getNodes } from '../../../api/locationNode.api';
import NodeMap, { hasCoordinates } from './NodeMap';

const fmtNumber = (v, digits = 2) =>
  v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('fr-FR', { maximumFractionDigits: digits });

/**
 * Onglet « Zones de couverture » : position du node + cercle du rayon de
 * livraison (nodes.delivery_radius_km) sur fond OpenStreetMap.
 * Les autres nodes actifs de la région sont affichés en gris (chevauchements).
 */
export default function NodeCoverageTab({ node, canUpdate, onSaved, showToast, onGoToLocation }) {
  const [radius, setRadius] = useState(node.delivery_radius_km ?? '');
  const [saving, setSaving] = useState(false);
  const [others, setOthers] = useState([]);

  useEffect(() => { setRadius(node.delivery_radius_km ?? ''); }, [node.delivery_radius_km]);

  useEffect(() => {
    if (!node.region_id) return;
    getNodes({ region_id: node.region_id, limit: 200 })
      .then(({ data }) => setOthers((data.data || []).filter((n) => n.id !== node.id)))
      .catch(() => setOthers([]));
  }, [node.id, node.region_id]);

  const positioned = hasCoordinates(node.lat, node.lng);
  const r = Number(radius);
  const radiusInvalid = radius !== '' && (!Number.isFinite(r) || r < 0);
  const area = radius !== '' && !radiusInvalid ? Math.PI * r * r : null;

  const handleSave = async () => {
    if (radiusInvalid) {
      showToast('error', 'Le rayon de livraison doit être positif ou nul');
      return;
    }
    setSaving(true);
    try {
      await updateNode(node.id, { delivery_radius_km: radius === '' ? null : r });
      showToast('success', 'Rayon de livraison mis à jour');
      onSaved();
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  if (!positioned) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <MapPin size={28} className="text-neutral-300" />
        <p className="text-sm font-medium text-neutral-600">Ce node n'a pas encore de coordonnées.</p>
        <p className="max-w-sm text-xs text-neutral-400">
          Placez le pin sur la carte ou saisissez la latitude / longitude dans l'onglet Localisation pour afficher sa zone de couverture.
        </p>
        {onGoToLocation && (
          <button onClick={onGoToLocation}
            className="mt-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
            Aller à l'onglet Localisation
          </button>
        )}
      </div>
    );
  }

  const previewRadius = radiusInvalid ? node.delivery_radius_km : radius;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <NodeMap
          lat={node.lat}
          lng={node.lng}
          radiusKm={previewRadius}
          label={node.name_fr}
          others={others}
          height={460}
        />
        <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-400">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#E10600]" /> Ce node et son rayon de livraison
          <span className="ml-3 inline-block h-2.5 w-2.5 rounded-full bg-neutral-400" /> Autres nodes de la région
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-neutral-200 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-800">
            <Radius size={15} className="text-[#E10600]" /> Rayon de livraison
          </h3>
          <label className="mb-1 block text-xs font-medium text-neutral-500">Rayon (km)</label>
          <input
            type="number" min="0" step="0.1" value={radius} disabled={!canUpdate}
            onChange={(e) => setRadius(e.target.value)}
            className={`w-full rounded-md border bg-neutral-50 px-3 py-2 text-sm outline-none transition focus:bg-white focus:ring-2 disabled:opacity-60 ${
              radiusInvalid ? 'border-[#E10600] focus:ring-[#E10600]/15' : 'border-neutral-200 focus:border-[#E10600] focus:ring-[#E10600]/15'
            }`}
          />
          {radiusInvalid && <p className="mt-1 text-xs text-[#E10600]">Le rayon doit être positif ou nul.</p>}
          {canUpdate && (
            <button onClick={handleSave} disabled={saving || radiusInvalid}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#E10600] px-4 py-2 text-sm font-medium text-white hover:bg-[#c00500] disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Enregistrer le rayon
            </button>
          )}
        </div>

        <dl className="space-y-2 rounded-xl border border-neutral-200 p-4 text-sm">
          <div className="flex justify-between gap-2"><dt className="text-neutral-500">Latitude</dt><dd className="font-mono text-neutral-800">{fmtNumber(node.lat, 7)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-neutral-500">Longitude</dt><dd className="font-mono text-neutral-800">{fmtNumber(node.lng, 7)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-neutral-500">Surface couverte</dt><dd className="text-neutral-800">{area === null ? '—' : `${fmtNumber(area, 1)} km²`}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-neutral-500">Ville</dt><dd className="text-neutral-800">{node.city?.name_fr || '—'}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-neutral-500">Capacité max / jour</dt><dd className="text-neutral-800">{node.max_daily_orders ?? '—'}</dd></div>
        </dl>

        <p className="flex gap-2 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">
          <Info size={14} className="mt-0.5 shrink-0" />
          La zone de couverture est un cercle centré sur le node. Pour déplacer le node, modifiez ses coordonnées dans l'onglet Localisation.
        </p>
      </div>
    </div>
  );
}
