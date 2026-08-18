import { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import { updateNode, getActiveNodeTypes } from '../../../api/locationNode.api';

export default function NodeInfoTab({ node, canUpdate, onSaved, showToast }) {
  const [nodeTypes, setNodeTypes] = useState([]);
  const [form, setForm] = useState({
    code: node.code || '',
    name_fr: node.name_fr || '',
    name_ar: node.name_ar || '',
    node_type_id: node.node_type_id || '',
    phone: node.phone || '',
    timezone: node.timezone || 'Africa/Casablanca',
    delivery_radius_km: node.delivery_radius_km ?? '',
    max_daily_orders: node.max_daily_orders ?? '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getActiveNodeTypes()
      .then(({ data }) => setNodeTypes(data.data || data || []))
      .catch(() => {});
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateNode(node.id, form);
      showToast('success', 'Informations mises à jour');
      onSaved();
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none transition focus:border-[#E10600] focus:bg-white focus:ring-2 focus:ring-[#E10600]/15 disabled:opacity-60";

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Code</label>
        <input value={form.code} onChange={set('code')} disabled={!canUpdate} className={`${inputClass} font-mono`} required />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Type de node</label>
        <select value={form.node_type_id} onChange={set('node_type_id')} disabled={!canUpdate} className={inputClass} required>
          <option value="">Sélectionner…</option>
          {nodeTypes.map((t) => <option key={t.id} value={t.id}>{t.name_fr}</option>)}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Nom (FR)</label>
        <input value={form.name_fr} onChange={set('name_fr')} disabled={!canUpdate} className={inputClass} required />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Nom (AR)</label>
        <input value={form.name_ar} onChange={set('name_ar')} disabled={!canUpdate} dir="rtl" className={inputClass} required />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Téléphone</label>
        <input value={form.phone} onChange={set('phone')} disabled={!canUpdate} className={inputClass} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Fuseau horaire</label>
        <input value={form.timezone} onChange={set('timezone')} disabled={!canUpdate} className={inputClass} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Rayon de livraison (km)</label>
        <input type="number" step="0.01" value={form.delivery_radius_km} onChange={set('delivery_radius_km')} disabled={!canUpdate} className={inputClass} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">Commandes max / jour</label>
        <input type="number" value={form.max_daily_orders} onChange={set('max_daily_orders')} disabled={!canUpdate} className={inputClass} />
      </div>

      {canUpdate && (
        <div className="sm:col-span-2 flex justify-end pt-2">
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