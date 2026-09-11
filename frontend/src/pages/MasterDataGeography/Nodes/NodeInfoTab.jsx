import { useState, useEffect } from 'react';
import { Loader2, Save, Info } from 'lucide-react';
import { updateNode, getActiveNodeTypes } from '../../../api/locationNode.api';
import Toggle from '../../../components/ui/Toggle';

const numOrEmpty = (v) => (v === null || v === undefined ? '' : String(v));

export default function NodeInfoTab({ node, canUpdate, onSaved, showToast }) {
  const [nodeTypes, setNodeTypes] = useState([]);
  const [form, setForm] = useState({
    code: node.code || '',
    name_fr: node.name_fr || '',
    name_ar: node.name_ar || '',
    node_type_id: node.node_type_id || '',
    phone: node.phone || '',
    timezone: node.timezone || 'Africa/Casablanca',
    delivery_radius_km: numOrEmpty(node.delivery_radius_km),
    max_daily_orders: numOrEmpty(node.max_daily_orders),
    delivery_fee: numOrEmpty(node.delivery_fee ?? 0),
    min_order_amount: numOrEmpty(node.min_order_amount ?? 0),
    slot_selection_enabled: node.slot_selection_enabled ?? true,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getActiveNodeTypes()
      .then(({ data }) => setNodeTypes(data.data || data || []))
      .catch(() => {});
  }, []);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const validate = () => {
    const er = {};
    if (!form.code.trim()) er.code = 'Code requis';
    if (!form.name_fr.trim()) er.name_fr = 'Nom FR requis';
    if (!form.name_ar.trim()) er.name_ar = 'Nom AR requis';
    if (!form.node_type_id) er.node_type_id = 'Type requis';
    const money = (v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0);
    if (!money(form.delivery_fee)) er.delivery_fee = 'Montant >= 0 MAD requis';
    if (!money(form.min_order_amount)) er.min_order_amount = 'Montant >= 0 MAD requis (0 = pas de minimum)';
    if (form.delivery_radius_km !== '' && !(Number(form.delivery_radius_km) >= 0)) er.delivery_radius_km = 'Rayon >= 0 requis';
    if (form.max_daily_orders !== '' && !(Number.isInteger(Number(form.max_daily_orders)) && Number(form.max_daily_orders) >= 0)) {
      er.max_daily_orders = 'Entier >= 0 requis';
    }
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await updateNode(node.id, {
        code: form.code.trim(),
        name_fr: form.name_fr.trim(),
        name_ar: form.name_ar.trim(),
        node_type_id: form.node_type_id,
        phone: form.phone.trim() || null,
        timezone: form.timezone.trim() || 'Africa/Casablanca',
        delivery_radius_km: form.delivery_radius_km === '' ? null : Number(form.delivery_radius_km),
        max_daily_orders: form.max_daily_orders === '' ? null : Number(form.max_daily_orders),
        delivery_fee: form.delivery_fee === '' ? 0 : Number(form.delivery_fee),
        min_order_amount: form.min_order_amount === '' ? 0 : Number(form.min_order_amount),
        slot_selection_enabled: Boolean(form.slot_selection_enabled),
      });
      showToast('success', 'Informations mises à jour');
      onSaved();
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = (key) =>
    `w-full rounded-md border bg-neutral-50 px-3 py-2 text-sm outline-none transition focus:bg-white focus:ring-2 disabled:opacity-60 ${
      errors[key] ? 'border-[#E10600] focus:ring-[#E10600]/15' : 'border-neutral-200 focus:border-[#E10600] focus:ring-[#E10600]/15'
    }`;

  const Err = ({ k }) => (errors[k] ? <p className="mt-1 text-xs text-[#E10600]">{errors[k]}</p> : null);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-neutral-800">Identité</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Code *</label>
            <input value={form.code} onChange={set('code')} disabled={!canUpdate} className={`${inputClass('code')} font-mono uppercase`} />
            <Err k="code" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Type de node *</label>
            <select value={form.node_type_id} onChange={set('node_type_id')} disabled={!canUpdate} className={inputClass('node_type_id')}>
              <option value="">Sélectionner…</option>
              {nodeTypes.map((t) => <option key={t.id} value={t.id}>{t.name_fr}</option>)}
            </select>
            <Err k="node_type_id" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Nom (FR) *</label>
            <input value={form.name_fr} onChange={set('name_fr')} disabled={!canUpdate} className={inputClass('name_fr')} />
            <Err k="name_fr" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Nom (AR) *</label>
            <input value={form.name_ar} onChange={set('name_ar')} disabled={!canUpdate} dir="rtl" className={inputClass('name_ar')} />
            <Err k="name_ar" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Téléphone</label>
            <input value={form.phone} onChange={set('phone')} disabled={!canUpdate} className={inputClass('phone')} placeholder="+212 6…" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Fuseau horaire</label>
            <input value={form.timezone} onChange={set('timezone')} disabled={!canUpdate} className={inputClass('timezone')} />
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-neutral-800">Paramètres opérationnels</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Rayon de livraison (km)</label>
            <input type="number" min="0" step="0.1" value={form.delivery_radius_km} onChange={set('delivery_radius_km')} disabled={!canUpdate} className={inputClass('delivery_radius_km')} />
            <Err k="delivery_radius_km" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Capacité max / jour (commandes)</label>
            <input type="number" min="0" step="1" value={form.max_daily_orders} onChange={set('max_daily_orders')} disabled={!canUpdate} className={inputClass('max_daily_orders')} />
            <Err k="max_daily_orders" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Frais de livraison (MAD)</label>
            <input type="number" min="0" step="0.01" value={form.delivery_fee} onChange={set('delivery_fee')} disabled={!canUpdate} className={inputClass('delivery_fee')} />
            <p className="mt-1 text-[11px] text-neutral-400">0 = livraison gratuite (peut être outrepassé par une promo livraison gratuite).</p>
            <Err k="delivery_fee" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Montant minimum de commande (MAD)</label>
            <input type="number" min="0" step="0.01" value={form.min_order_amount} onChange={set('min_order_amount')} disabled={!canUpdate} className={inputClass('min_order_amount')} />
            <p className="mt-1 text-[11px] text-neutral-400">0 = pas de minimum. Seul le sous-total payé compte (articles échangés contre des points exclus).</p>
            <Err k="min_order_amount" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-neutral-800">Sélection de créneau par le client au checkout</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {form.slot_selection_enabled
                ? 'Activé : le client choisit un créneau parmi les créneaux ouverts du node.'
                : "Désactivé : le client ne choisit pas de créneau ; l'équipe l'affecte ensuite."}
            </p>
          </div>
          {canUpdate ? (
            <Toggle
              checked={Boolean(form.slot_selection_enabled)}
              onChange={() => setForm((f) => ({ ...f, slot_selection_enabled: !f.slot_selection_enabled }))}
              activeLabel="Activée"
              inactiveLabel="Désactivée"
            />
          ) : (
            <span className="text-sm font-semibold text-neutral-500">{form.slot_selection_enabled ? 'Activée' : 'Désactivée'}</span>
          )}
        </div>

        <p className="mt-3 flex gap-2 text-xs text-neutral-400">
          <Info size={14} className="mt-0.5 shrink-0" />
          Les changements de frais, de minimum ou de mode de créneau ne sont pas rétroactifs : ils s'appliquent aux nouvelles commandes. Toute modification est tracée dans le journal d'audit.
        </p>
      </section>

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
