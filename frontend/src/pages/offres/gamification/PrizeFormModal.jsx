import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import Modal from '../../../components/Modal';
import { getNodePacks, searchNodeSkus } from '../../../api/gamification.api';
import { errMsg } from './gamificationUtils';

function emptyPrize(prizeTypes) {
  return {
    prize_type_id: prizeTypes.find((t) => t.code === 'points')?.id ?? '',
    name_fr: '',
    name_ar: '',
    value: '',
    sku_id: '',
    sku_label: '',
    pack_id: '',
    coupon_code_prefix: '',
    coupon_promo_type_id: '',
    coupon_min_order_amount: '0',
    coupon_validity_days: '30',
    probability_weight: '',
    stock_limit: '',
    sort_order: '0',
    is_active: true,
  };
}

function fromPrize(p) {
  const s = (v) => (v === null || v === undefined ? '' : String(v));
  return {
    prize_type_id: p.prize_type_id ?? '',
    name_fr: p.name_fr ?? '',
    name_ar: p.name_ar ?? '',
    value: s(p.value),
    sku_id: p.sku_id ?? '',
    sku_label: p.sku_label ?? '',
    pack_id: p.pack_id ?? '',
    coupon_code_prefix: p.coupon_code_prefix ?? '',
    coupon_promo_type_id: p.coupon_promo_type_id ?? '',
    coupon_min_order_amount: s(p.coupon_min_order_amount ?? 0),
    coupon_validity_days: s(p.coupon_validity_days ?? 30),
    probability_weight: s(p.probability_weight),
    stock_limit: s(p.stock_limit),
    sort_order: s(p.sort_order ?? 0),
    is_active: p.is_active !== false,
  };
}

/**
 * Formulaire d'un lot (US-081). N'affiche que les champs du type choisi ;
 * les autres sont envoyés vides (NULL côté API).
 * @param {object}  props
 * @param {object|null} props.prize   lot existant (null = création)
 * @param {boolean} props.locked      lot déjà attribué : type et valeur en lecture seule
 * @param {Function} props.onSubmit   (payload) => Promise
 */
export default function PrizeFormModal({ open, onClose, prize, locked = false, prizeTypes = [], couponPromoTypes = [], nodeId, onSubmit }) {
  const [form, setForm] = useState(() => (prize ? fromPrize(prize) : emptyPrize(prizeTypes)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [packs, setPacks] = useState([]);
  const [skuSearch, setSkuSearch] = useState('');
  const [skuOptions, setSkuOptions] = useState([]);
  const [skuStock, setSkuStock] = useState(prize?.sku_stock ?? null);

  useEffect(() => {
    if (!open) return;
    setForm(prize ? fromPrize(prize) : emptyPrize(prizeTypes));
    setSkuStock(prize?.sku_stock ?? null);
    setSkuSearch('');
    setError(null);
  }, [open, prize, prizeTypes]);

  const typeCode = useMemo(() => prizeTypes.find((t) => t.id === form.prize_type_id)?.code ?? '', [prizeTypes, form.prize_type_id]);

  useEffect(() => {
    if (!open || typeCode !== 'free_pack' || !nodeId) return;
    getNodePacks(nodeId).then(({ data }) => setPacks(data.data ?? [])).catch(() => setPacks([]));
  }, [open, typeCode, nodeId]);

  useEffect(() => {
    if (!open || typeCode !== 'free_sku' || !nodeId || locked) return undefined;
    const t = setTimeout(() => {
      searchNodeSkus(nodeId, skuSearch)
        .then(({ data }) => setSkuOptions(data.data ?? []))
        .catch(() => setSkuOptions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [open, typeCode, nodeId, skuSearch, locked]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const lockedField = locked;
  const couponPromoCode = couponPromoTypes.find((t) => t.id === form.coupon_promo_type_id)?.code;

  async function submit(e) {
    e?.preventDefault();
    setError(null);
    const payload = {
      prize_type_id: form.prize_type_id,
      name_fr: form.name_fr,
      name_ar: form.name_ar,
      probability_weight: form.probability_weight,
      stock_limit: typeCode === 'no_prize' ? null : (form.stock_limit === '' ? null : form.stock_limit),
      sort_order: form.sort_order === '' ? 0 : form.sort_order,
      is_active: form.is_active,
      value: ['points', 'coupon'].includes(typeCode) ? form.value : null,
      sku_id: typeCode === 'free_sku' ? form.sku_id || null : null,
      pack_id: typeCode === 'free_pack' ? form.pack_id || null : null,
      coupon_code_prefix: typeCode === 'coupon' ? form.coupon_code_prefix : null,
      coupon_promo_type_id: typeCode === 'coupon' ? form.coupon_promo_type_id || null : null,
      coupon_min_order_amount: typeCode === 'coupon' ? (form.coupon_min_order_amount === '' ? 0 : form.coupon_min_order_amount) : 0,
      coupon_validity_days: typeCode === 'coupon' ? (form.coupon_validity_days === '' ? 30 : form.coupon_validity_days) : 30,
    };
    // champs d'affichage pour le mode local (création du jeu)
    const display = {
      sku_label: form.sku_label,
      pack_label: packs.find((p) => p.id === form.pack_id)?.name_fr ?? prize?.pack_label ?? null,
      sku_stock: skuStock,
    };
    setSaving(true);
    try {
      await onSubmit(payload, display);
    } catch (err) {
      setError(errMsg(err, "Échec de l'enregistrement du lot"));
    } finally {
      setSaving(false);
    }
  }

  const noNode = ['free_sku', 'free_pack'].includes(typeCode) && !nodeId;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={prize ? 'Modifier le lot' : 'Ajouter un lot'}
      subtitle={prize?.id}
      size="md"
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
          <button type="button" onClick={submit} disabled={saving} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Enregistrer le lot'}
          </button>
        </>
      )}
    >
      <form onSubmit={submit} className="space-y-4">
        {locked && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <Lock size={16} className="mt-0.5 shrink-0" />
            Lot déjà attribué ({prize?.awarded_count}) : le type, les noms et la valeur sont verrouillés. Seuls le poids, le stock max, l'ordre et l'activation restent modifiables.
          </div>
        )}
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div>
          <label className="form-label">Type de lot *</label>
          <select className="form-select" value={form.prize_type_id} disabled={lockedField} onChange={(e) => set('prize_type_id', e.target.value)}>
            {prizeTypes.map((t) => <option key={t.id} value={t.id}>{t.name_fr} ({t.code})</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="form-label">Nom FR *</label>
            <input className="form-input" value={form.name_fr} disabled={lockedField} onChange={(e) => set('name_fr', e.target.value)} placeholder="ex. 50 points" maxLength={150} />
          </div>
          <div>
            <label className="form-label">Nom AR *</label>
            <input className="form-input" dir="rtl" value={form.name_ar} disabled={lockedField} onChange={(e) => set('name_ar', e.target.value)} maxLength={150} />
          </div>
        </div>

        {typeCode === 'points' && (
          <div>
            <label className="form-label">Nombre de points *</label>
            <input type="number" min="1" step="1" className="form-input" value={form.value} disabled={lockedField} onChange={(e) => set('value', e.target.value)} />
            <p className="mt-1 text-xs text-gray-400">Crédités en points de fidélité (échangeables contre des SKU via Points Exchange) — jamais en MAD.</p>
          </div>
        )}

        {typeCode === 'coupon' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="form-label">Préfixe du code *</label>
              <input className="form-input uppercase" value={form.coupon_code_prefix} disabled={lockedField} onChange={(e) => set('coupon_code_prefix', e.target.value.toUpperCase())} maxLength={20} placeholder="ex. ROUE" />
            </div>
            <div>
              <label className="form-label">Type de promo *</label>
              <select className="form-select" value={form.coupon_promo_type_id} disabled={lockedField} onChange={(e) => set('coupon_promo_type_id', e.target.value)}>
                <option value="">— Choisir —</option>
                {couponPromoTypes.map((t) => <option key={t.id} value={t.id}>{t.code === 'PERCENTAGE' ? 'Pourcentage (%)' : 'Montant fixe (MAD)'}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Valeur * {couponPromoCode === 'PERCENTAGE' ? '(%)' : '(MAD)'}</label>
              <input type="number" min="0" step="0.01" className="form-input" value={form.value} disabled={lockedField} onChange={(e) => set('value', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Montant minimum de commande (MAD)</label>
              <input type="number" min="0" step="0.01" className="form-input" value={form.coupon_min_order_amount} disabled={lockedField} onChange={(e) => set('coupon_min_order_amount', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Durée de validité (jours) *</label>
              <input type="number" min="1" step="1" className="form-input" value={form.coupon_validity_days} disabled={lockedField} onChange={(e) => set('coupon_validity_days', e.target.value)} />
            </div>
            <p className="self-end text-xs text-gray-400 sm:col-span-2">Au gain : code nominatif, 1 utilisation, non cumulable, valable à partir de la date du gain.</p>
          </div>
        )}

        {noNode && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Choisissez d'abord le node du jeu (onglet « Configuration »).</p>}

        {typeCode === 'free_sku' && nodeId && (
          <div>
            <label className="form-label">SKU offert *</label>
            {form.sku_id && (
              <div className="mb-2 flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <span>{form.sku_label || form.sku_id}</span>
                {skuStock !== null && <span className={skuStock > 0 ? 'text-emerald-600' : 'text-amber-600'}>Stock node : {skuStock}</span>}
              </div>
            )}
            {!lockedField && (
              <>
                <input className="form-input" placeholder="Rechercher un SKU (nom, code, EAN)…" value={skuSearch} onChange={(e) => setSkuSearch(e.target.value)} />
                <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-100">
                  {skuOptions.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">Aucun SKU trouvé.</p>}
                  {skuOptions.map((s) => (
                    <button type="button" key={s.id} onClick={() => { set('sku_id', s.id); set('sku_label', `${s.sku_code} — ${s.name_fr}`); setSkuStock(s.qty_available); }}
                      className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${form.sku_id === s.id ? 'bg-red-50' : ''}`}>
                      <span>{s.sku_code} — {s.name_fr}</span>
                      <span className={s.qty_available > 0 ? 'text-xs text-emerald-600' : 'text-xs text-amber-600'}>stock {s.qty_available}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {form.sku_id && skuStock !== null && !(skuStock > 0) && (
              <p className="mt-2 flex items-center gap-1 text-xs text-amber-700"><AlertTriangle size={14} /> Pas de stock sur le node du jeu : avertissement non bloquant (réapprovisionnement possible avant activation).</p>
            )}
          </div>
        )}

        {typeCode === 'free_pack' && nodeId && (
          <div>
            <label className="form-label">Pack offert * <span className="font-normal text-gray-400">(packs du node du jeu uniquement)</span></label>
            <select className="form-select" value={form.pack_id} disabled={lockedField} onChange={(e) => set('pack_id', e.target.value)}>
              <option value="">— Choisir un pack —</option>
              {packs.map((p) => <option key={p.id} value={p.id}>{p.name_fr}{p.is_active ? '' : ' (inactif)'}</option>)}
              {form.pack_id && !packs.some((p) => p.id === form.pack_id) && <option value={form.pack_id}>{prize?.pack_label ?? form.pack_id}</option>}
            </select>
          </div>
        )}

        {typeCode === 'no_prize' && (
          <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">« Aucun gain » : aucune valeur. Donnez-lui un poids élevé pour équilibrer le jeu ; une partie perdue consomme le quota.</p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="form-label">Poids de probabilité *</label>
            <input type="number" min="0" step="0.0001" className="form-input" value={form.probability_weight} onChange={(e) => set('probability_weight', e.target.value)} />
          </div>
          {typeCode !== 'no_prize' && (
            <div>
              <label className="form-label">Stock max</label>
              <input type="number" min="1" step="1" className="form-input" value={form.stock_limit} onChange={(e) => set('stock_limit', e.target.value)} placeholder="Illimité" />
            </div>
          )}
          <div>
            <label className="form-label">Ordre d'affichage</label>
            <input type="number" min="0" step="1" className="form-input" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="form-checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
          Lot actif (participe au tirage)
        </label>
      </form>
    </Modal>
  );
}
