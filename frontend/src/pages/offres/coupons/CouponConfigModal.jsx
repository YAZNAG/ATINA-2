import { useEffect, useMemo, useState } from 'react';
import { Loader2, Power, PowerOff, Save, Search, Trash2, X, ListChecks } from 'lucide-react';
import Modal from '../../../components/Modal';
import {
  getCoupon, createCoupon, updateCoupon, setCouponActive, searchCouponCustomers,
} from '../../../api/coupons.api';
import {
  apiError, fromLocalInput, toLocalInput, Notice, primaryBtn, formatDate,
} from './offresUi';

const ALL_FIELDS = [
  'code', 'promo_type_id', 'value', 'max_discount', 'min_order_amount', 'is_combined', 'customer_id',
  'node_id', 'uses_max', 'uses_per_user_max', 'valid_from', 'valid_to', 'is_active',
];

function defaultForm() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 30 * 86400000);
  return {
    code: '', promo_type_id: '', value: '', max_discount: '', min_order_amount: '0', is_combined: false,
    customer_id: '', customer_label: '', node_id: '', uses_max: '', uses_per_user_max: '1',
    valid_from: toLocalInput(start), valid_to: toLocalInput(end), is_active: true,
  };
}

function fromCoupon(c) {
  return {
    code: c.code ?? '',
    promo_type_id: c.type_id ?? '',
    value: c.value != null ? String(c.value) : '',
    max_discount: c.max_discount != null ? String(c.max_discount) : '',
    min_order_amount: c.min_order_amount != null ? String(c.min_order_amount) : '0',
    is_combined: !!c.is_combined,
    customer_id: c.customer_id ?? '',
    customer_label: c.customer_id ? `${c.customer_name ?? ''}${c.customer_phone ? ` · ${c.customer_phone}` : ''}` : '',
    node_id: c.node_id ?? '',
    uses_max: c.uses_max != null ? String(c.uses_max) : '',
    uses_per_user_max: c.uses_per_user_max != null ? String(c.uses_per_user_max) : '1',
    valid_from: toLocalInput(c.valid_from),
    valid_to: toLocalInput(c.valid_to),
    is_active: !!c.is_active,
  };
}

function Field({ label, required, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label className="form-label">{label}{required && <span className="text-red-600"> *</span>}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

/**
 * « Configuration code » (WF #17 / WF #34, US-076 / US-077).
 * Édition selon usage : uses_count = 0 → tout ouvert ; > 0 → validité (fin), max usage et activation ;
 * origine Gamification / Parrainage → lecture seule (désactiver / supprimer uniquement).
 */
export default function CouponConfigModal({
  open, couponId, lookups, canManage, onClose, onSaved, onDelete, onShowUsages,
}) {
  const [coupon, setCoupon] = useState(null);
  const [form, setForm] = useState(defaultForm());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [custSearch, setCustSearch] = useState('');
  const [custResults, setCustResults] = useState([]);
  const [custLoading, setCustLoading] = useState(false);

  const isNew = !couponId;
  const promoTypes = lookups?.promo_types ?? [];
  const nodes = lookups?.nodes ?? [];

  useEffect(() => {
    if (!open) return;
    setError(null); setSuccess(null); setCustSearch(''); setCustResults([]);
    if (!couponId) {
      setCoupon(null);
      const f = defaultForm();
      const pct = promoTypes.find((t) => t.code === 'PERCENTAGE');
      if (pct) f.promo_type_id = pct.id;
      setForm(f);
      return;
    }
    setLoading(true);
    getCoupon(couponId)
      .then(({ data }) => { setCoupon(data.data); setForm(fromCoupon(data.data)); })
      .catch((err) => setError(apiError(err, 'Code promo introuvable')))
      .finally(() => setLoading(false));
  }, [open, couponId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recherche client (nom / téléphone)
  useEffect(() => {
    if (!custSearch || custSearch.trim().length < 2) { setCustResults([]); return undefined; }
    const t = setTimeout(async () => {
      setCustLoading(true);
      try {
        const { data } = await searchCouponCustomers(custSearch.trim());
        setCustResults(data.data ?? []);
      } catch { setCustResults([]); } finally { setCustLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [custSearch]);

  const editable = useMemo(() => {
    if (!canManage) return [];
    if (isNew) return ALL_FIELDS;
    return coupon?.editable_fields ?? [];
  }, [canManage, isNew, coupon]);
  const can = (f) => editable.includes(f);

  const typeCode = promoTypes.find((t) => t.id === form.promo_type_id)?.code;
  const isFreeShipping = typeCode === 'FREE_SHIPPING';
  const isPercent = typeCode === 'PERCENTAGE';
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function clientValidate() {
    if (!form.code.trim()) return 'Le code est obligatoire';
    if (!form.promo_type_id) return 'Le type de remise est obligatoire';
    if (!isFreeShipping) {
      const v = Number(form.value);
      if (!(v > 0)) return 'La valeur doit être strictement supérieure à 0';
      if (isPercent && v > 100) return 'Un pourcentage ne peut pas dépasser 100';
    }
    if (!form.valid_from || !form.valid_to) return 'Les dates de validité sont obligatoires';
    if (new Date(form.valid_to) <= new Date(form.valid_from)) return 'La date de fin doit être postérieure à la date de début';
    if (form.uses_max !== '' && coupon && Number(form.uses_max) < coupon.uses_count) {
      return `Le nombre maximal d'utilisations doit être ≥ ${coupon.uses_count} (utilisations déjà constatées)`;
    }
    return null;
  }

  function buildPayload() {
    const all = {
      code: form.code.trim().toUpperCase(),
      promo_type_id: form.promo_type_id,
      value: isFreeShipping ? 0 : form.value,
      max_discount: isPercent ? form.max_discount : '',
      min_order_amount: form.min_order_amount === '' ? 0 : form.min_order_amount,
      is_combined: form.is_combined,
      customer_id: form.customer_id || null,
      node_id: form.node_id || null,
      uses_max: form.uses_max === '' ? null : form.uses_max,
      uses_per_user_max: form.uses_per_user_max === '' ? 1 : form.uses_per_user_max,
      valid_from: fromLocalInput(form.valid_from),
      valid_to: fromLocalInput(form.valid_to),
      is_active: form.is_active,
    };
    if (isNew) return all;
    const out = {};
    editable.filter((k) => k !== 'is_active').forEach((k) => { out[k] = all[k]; });
    return out;
  }

  async function handleSave() {
    const msg = clientValidate();
    if (msg) { setError(msg); return; }
    setSaving(true); setError(null); setSuccess(null);
    try {
      const payload = buildPayload();
      const { data } = isNew ? await createCoupon(payload) : await updateCoupon(couponId, payload);
      setCoupon(data.data); setForm(fromCoupon(data.data));
      setSuccess(isNew ? 'Code promo créé.' : 'Modifications enregistrées.');
      onSaved?.(data.data);
    } catch (err) {
      setError(apiError(err));
    } finally { setSaving(false); }
  }

  async function handleToggle() {
    if (!coupon) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const { data } = await setCouponActive(coupon.id, !coupon.is_active);
      setCoupon((c) => ({ ...c, ...data.data }));
      setForm((f) => ({ ...f, is_active: data.data.is_active }));
      setSuccess(data.data.is_active ? 'Code activé.' : 'Code désactivé.');
      onSaved?.(data.data);
    } catch (err) { setError(apiError(err)); } finally { setSaving(false); }
  }

  const readOnlyAll = !isNew && editable.filter((k) => k !== 'is_active').length === 0;
  const title = isNew ? 'Créer un code promo' : `Code ${coupon?.code ?? ''}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={coupon ? `${coupon.origin_label} · ${coupon.status_label} · ${coupon.uses_count} utilisation(s)` : 'Configuration code'}
      size="lg"
      footer={(
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {!isNew && coupon && !coupon.is_deleted && canManage && (
              <button type="button" className="btn-icon-delete px-3 py-2" onClick={() => onDelete?.(coupon)}>
                <Trash2 size={15} /> Supprimer
              </button>
            )}
            {!isNew && coupon && (
              <button type="button" className="btn-icon-edit px-3 py-2" onClick={() => onShowUsages?.(coupon)}>
                <ListChecks size={15} /> Voir les utilisations
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Fermer</button>
            {!isNew && coupon && !coupon.is_deleted && canManage && (
              <button type="button" className="btn-secondary" disabled={saving} onClick={handleToggle}>
                {coupon.is_active ? <><PowerOff size={16} /> Désactiver</> : <><Power size={16} /> Activer</>}
              </button>
            )}
            {canManage && !readOnlyAll && !(coupon?.is_deleted) && (
              <button type="button" className={primaryBtn} disabled={saving || loading} onClick={handleSave}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer
              </button>
            )}
          </div>
        </div>
      )}
    >
      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-neutral-500"><Loader2 size={16} className="animate-spin" /> Chargement…</div>
      ) : (
        <div className="space-y-4">
          {error && <Notice tone="red">{error}</Notice>}
          {success && <Notice tone="green">{success}</Notice>}
          {coupon?.is_deleted && (
            <Notice tone="zinc">Code supprimé le {formatDate(coupon.deleted_at)} : lecture seule, il ne peut plus être modifié ni réactivé.</Notice>
          )}
          {coupon && !coupon.is_deleted && coupon.origin !== 'manual' && (
            <Notice tone="blue">
              Code généré automatiquement — origine <strong>{coupon.origin_label}</strong>
              {coupon.play_id && <> (partie de jeu <span className="font-mono text-xs">{coupon.play_id}</span>)</>}
              {coupon.referral_id && <> (parrainage <span className="font-mono text-xs">{coupon.referral_id}</span>)</>}.
              Ses paramètres sont en lecture seule : seules la désactivation et la suppression sont possibles.
              Pour changer les futurs gains, modifiez le lot du jeu ou la configuration de parrainage.
            </Notice>
          )}
          {coupon && !coupon.is_deleted && coupon.origin === 'manual' && coupon.uses_count > 0 && (
            <Notice>
              Ce code a déjà été utilisé <strong>{coupon.uses_count}</strong> fois : seuls la date de fin, le nombre maximal
              d'utilisations (≥ {coupon.uses_count}) et l'activation restent modifiables. Pour de nouvelles conditions,
              créez un nouveau code et désactivez celui-ci.
            </Notice>
          )}
          {coupon && coupon.active_orders_count > 0 && (
            <Notice tone="zinc">{coupon.active_orders_count} commande(s) en cours référencent ce code.</Notice>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Code" required hint="Mémorisable et sans ambiguïté (évitez O/0, I/l). Unique.">
              <input className="form-input font-mono uppercase" value={form.code} disabled={!can('code')}
                onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="EX : WELCOME20" maxLength={50} />
            </Field>
            <Field label="Type de remise" required>
              <select className="form-select" value={form.promo_type_id} disabled={!can('promo_type_id')}
                onChange={(e) => set('promo_type_id', e.target.value)}>
                <option value="">— Choisir —</option>
                {promoTypes.map((t) => <option key={t.id} value={t.id}>{t.name_fr} ({t.code})</option>)}
              </select>
            </Field>
            <Field label={isPercent ? 'Valeur (%)' : isFreeShipping ? 'Valeur' : 'Valeur (MAD)'} required={!isFreeShipping}
              hint={isFreeShipping ? 'Livraison offerte : pas de valeur à saisir.' : isPercent ? 'Entre 0 et 100 %.' : 'Montant fixe déduit.'}>
              <input type="number" min="0" step="0.01" className="form-input" value={isFreeShipping ? '' : form.value}
                disabled={!can('value') || isFreeShipping} onChange={(e) => set('value', e.target.value)} />
            </Field>
            {isPercent && (
              <Field label="Remise maximale (MAD)" hint="Optionnel : plafond de la réduction en pourcentage.">
                <input type="number" min="0" step="0.01" className="form-input" value={form.max_discount}
                  disabled={!can('max_discount')} onChange={(e) => set('max_discount', e.target.value)} />
              </Field>
            )}
            <Field label="Node (scope)" hint="Vide = code global, valable sur tous les nodes.">
              <select className="form-select" value={form.node_id} disabled={!can('node_id')} onChange={(e) => set('node_id', e.target.value)}>
                <option value="">Global (tous les nodes)</option>
                {nodes.map((n) => <option key={n.id} value={n.id}>{n.name_fr} ({n.code})</option>)}
              </select>
            </Field>
            <Field label="Montant minimum de commande (MAD)">
              <input type="number" min="0" step="0.01" className="form-input" value={form.min_order_amount}
                disabled={!can('min_order_amount')} onChange={(e) => set('min_order_amount', e.target.value)} />
            </Field>
            <Field label="Client affecté (optionnel)" className="md:col-span-2"
              hint="Vide = code public (tout client). Renseigné = code nominatif : seul ce client peut le saisir au checkout.">
              {form.customer_id ? (
                <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
                  <span>{form.customer_label || form.customer_id}</span>
                  {can('customer_id') && (
                    <button type="button" className="text-neutral-500 hover:text-red-600" title="Retirer"
                      onClick={() => setForm((f) => ({ ...f, customer_id: '', customer_label: '' }))}><X size={16} /></button>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input className="form-input pl-9" placeholder="Rechercher un client (nom ou téléphone)…" value={custSearch}
                    disabled={!can('customer_id')} onChange={(e) => setCustSearch(e.target.value)} />
                  {(custLoading || custResults.length > 0) && (
                    <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
                      {custLoading && <div className="px-3 py-2 text-xs text-neutral-500">Recherche…</div>}
                      {custResults.map((c) => (
                        <button key={c.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
                          onClick={() => {
                            setForm((f) => ({ ...f, customer_id: c.id, customer_label: `${c.name} · ${c.phone_country ?? ''}${c.phone_number}` }));
                            setCustSearch(''); setCustResults([]);
                          }}>
                          <span className="font-medium">{c.name}</span>
                          <span className="ml-2 text-xs text-neutral-500">{c.phone_country}{c.phone_number}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Field>
            <Field label="Nb max d'utilisations (total)" hint="Vide = illimité.">
              <input type="number" min="1" step="1" className="form-input" value={form.uses_max}
                disabled={!can('uses_max')} onChange={(e) => set('uses_max', e.target.value)} />
            </Field>
            <Field label="Nb max d'utilisations par client">
              <input type="number" min="1" step="1" className="form-input" value={form.uses_per_user_max}
                disabled={!can('uses_per_user_max')} onChange={(e) => set('uses_per_user_max', e.target.value)} />
            </Field>
            <Field label="Validité — début" required>
              <input type="datetime-local" className="form-input" value={form.valid_from}
                disabled={!can('valid_from')} onChange={(e) => set('valid_from', e.target.value)} />
            </Field>
            <Field label="Validité — fin" required>
              <input type="datetime-local" className="form-input" value={form.valid_to}
                disabled={!can('valid_to')} onChange={(e) => set('valid_to', e.target.value)} />
            </Field>
            <div className="md:col-span-2 space-y-2">
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" className="form-checkbox mt-0.5" checked={form.is_combined}
                  disabled={!can('is_combined')} onChange={(e) => set('is_combined', e.target.checked)} />
                <span>
                  <strong>Cumul avec d'autres offres</strong> (is_combined)
                  <span className="block text-xs text-neutral-500">
                    Décoché (par défaut) : la réduction ne s'applique pas si le panier bénéficie déjà d'une flash sale ou d'un prix pack.
                    Coché : la réduction s'ajoute par-dessus.
                  </span>
                </span>
              </label>
              {isNew && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" className="form-checkbox" checked={form.is_active}
                    onChange={(e) => set('is_active', e.target.checked)} />
                  Activer le code dès l'enregistrement
                </label>
              )}
            </div>
          </div>

          {coupon && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600 md:grid-cols-4">
              <div><span className="block text-neutral-400">Utilisations</span>{coupon.uses_count}{coupon.uses_max != null ? ` / ${coupon.uses_max}` : ' / illimité'}</div>
              <div><span className="block text-neutral-400">Origine</span>{coupon.origin_label}</div>
              <div><span className="block text-neutral-400">Créé le</span>{formatDate(coupon.created_at)}</div>
              <div><span className="block text-neutral-400">Modifié le</span>{formatDate(coupon.updated_at)}</div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
