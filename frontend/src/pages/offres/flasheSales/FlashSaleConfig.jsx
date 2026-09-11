import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ImageOff, Loader2, Power, PowerOff, Save, Search, Trash2, Upload,
} from 'lucide-react';
import {
  getFlashSale, createFlashSale, updateFlashSale, setFlashSaleActive, getFlashLookups, getFlashCeiling,
} from '../../../api/offres.api';
import {
  apiError, formatDate, fromLocalInput, money, Notice, primaryBtn, toLocalInput,
} from '../coupons/offresUi';
import { FlashStatusBadge } from './flashStatus';

function defaultForm() {
  const start = new Date(Date.now() + 3600000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 2 * 86400000);
  return {
    node_id: '', target: 'sku', sku_id: '', pack_id: '', target_label: '',
    name_fr: '', name_ar: '', flash_price: '', stock_flash: '', max_qty_per_user: '1',
    starts_at: toLocalInput(start), ends_at: toLocalInput(end),
  };
}

function fromItem(it) {
  return {
    node_id: it.node_id ?? '',
    target: it.target ?? (it.pack_id ? 'pack' : 'sku'),
    sku_id: it.sku_id ?? '',
    pack_id: it.pack_id ?? '',
    target_label: it.target === 'pack' ? (it.pack_name ?? '') : `${it.scope_name ?? ''}${it.sku_code ? ` (${it.sku_code})` : ''}`,
    name_fr: it.custom_name_fr ?? '',
    name_ar: it.custom_name_ar ?? '',
    flash_price: it.flash_price != null ? String(it.flash_price) : '',
    stock_flash: it.stock_flash != null ? String(it.stock_flash) : '',
    max_qty_per_user: it.max_qty_per_user != null ? String(it.max_qty_per_user) : '1',
    starts_at: toLocalInput(it.starts_at),
    ends_at: toLocalInput(it.ends_at),
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

/** Panneau « plafond flash » : garde-fous WF #1 étape 7 / WF #18 section D. */
function CeilingPanel({ data, loading }) {
  if (loading) return <div className="flex items-center gap-2 text-xs text-neutral-500"><Loader2 size={14} className="animate-spin" /> Calcul du plafond…</div>;
  if (!data) return null;
  const c = data.ceiling;
  if (!c) return null;
  return (
    <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <span>Plafond minimal : <strong>{data.min_allowed ?? 1}</strong>{data.sold_count > 0 && ` (déjà vendu : ${data.sold_count})`}</span>
        <span>Plafond maximal : <strong>{data.max_allowed == null ? 'illimité' : data.max_allowed}</strong> {c.target === 'pack' ? 'pack(s)' : 'unité(s)'}</span>
      </div>
      <p className="text-neutral-500">Calcul : {c.explanation}.</p>
      {c.target === 'sku' && (
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>Disponible node : <strong>{c.qty_available}</strong></span>
          <span>Vente en rupture : <strong>{c.is_backorderable ? 'autorisée' : 'non'}</strong></span>
          {c.is_backorderable && <span>Capacité de rupture restante : <strong>{c.backorder_capacity == null ? 'illimitée' : c.backorder_capacity}</strong></span>}
          {c.is_backorderable && <span>Délai de réappro : <strong>{c.estimated_restock_days ?? '?'} j</strong></span>}
          {!c.has_selling_rule && <span className="text-amber-700">Aucune règle de vente sur ce node.</span>}
        </div>
      )}
      {c.target === 'pack' && (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span>Packs assemblables : <strong>{c.packs_assemblable}</strong></span>
            <span>max_pack_qty : <strong>{c.max_pack_qty ?? '—'}</strong>{c.max_pack_qty != null && ` (reste ${c.remaining_pack_cap})`}</span>
            <span>Pack vendable en rupture : <strong>{c.is_backorderable ? 'oui' : 'non'}</strong></span>
          </div>
          <table className="w-full">
            <thead className="text-neutral-400">
              <tr><th className="py-1 text-left">Composant</th><th className="text-right">Qté / pack</th><th className="text-right">Disponible</th><th className="text-right">Packs réalisables</th></tr>
            </thead>
            <tbody>
              {c.components.map((comp) => (
                <tr key={comp.sku_id} className={c.limiting_component?.sku_id === comp.sku_id ? 'font-semibold text-red-600' : ''}>
                  <td className="py-0.5">{comp.name_fr ?? comp.sku_code}{c.limiting_component?.sku_id === comp.sku_id && ' (limitant)'}</td>
                  <td className="text-right">{comp.qty_per_pack}</td>
                  <td className="text-right">{comp.qty_available}</td>
                  <td className="text-right">{comp.packs_possible}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {(data.errors ?? []).map((e) => <Notice key={e} tone="red">{e}</Notice>)}
      {(data.warnings ?? []).map((w) => <Notice key={w}>{w}</Notice>)}
    </div>
  );
}

/**
 * Onglet « Configuration flash sale » (WF #1, #18, #33 ; US-074, US-075, US-111).
 */
export default function FlashSaleConfig({ id, nodes, canManage, onSaved, onBack, onDelete, initialSuccess = null }) {
  const [item, setItem] = useState(null);
  const [form, setForm] = useState(defaultForm());
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(initialSuccess);
  const [warnings, setWarnings] = useState([]);
  const [targetSearch, setTargetSearch] = useState('');
  const [options, setOptions] = useState({ skus: [], packs: [] });
  const [optLoading, setOptLoading] = useState(false);
  const [ceiling, setCeiling] = useState(null);
  const [ceilingLoading, setCeilingLoading] = useState(false);
  const fileRef = useRef(null);

  const isNew = !id;
  const readOnly = !canManage || (!!item && item.read_only);
  const started = !!item?.has_started;

  // Chargement
  useEffect(() => {
    setError(null); setWarnings([]); setImage(null); setPreview(null); setCeiling(null);
    if (!id) { setItem(null); setForm(defaultForm()); return; }
    setLoading(true);
    getFlashSale(id)
      .then(({ data }) => {
        setItem(data.data);
        setForm(fromItem(data.data));
        setWarnings(data.data.warnings ?? []);
      })
      .catch((err) => setError(apiError(err, 'Vente flash introuvable')))
      .finally(() => setLoading(false));
  }, [id]);

  // Recherche de la cible (création uniquement)
  useEffect(() => {
    if (!isNew || !form.node_id) { setOptions({ skus: [], packs: [] }); return undefined; }
    const t = setTimeout(async () => {
      setOptLoading(true);
      try {
        const { data } = await getFlashLookups({ node_id: form.node_id, target: form.target, search: targetSearch || undefined });
        setOptions({ skus: data.data.skus ?? [], packs: data.data.packs ?? [] });
      } catch { setOptions({ skus: [], packs: [] }); } finally { setOptLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [isNew, form.node_id, form.target, targetSearch]);

  // Plafond flash recalculé en direct (ouverture + saisie)
  const targetId = form.target === 'pack' ? form.pack_id : form.sku_id;
  useEffect(() => {
    if (!form.node_id || !targetId) { setCeiling(null); return undefined; }
    const t = setTimeout(async () => {
      setCeilingLoading(true);
      try {
        const params = id
          ? { id, stock_flash: form.stock_flash || undefined }
          : { node_id: form.node_id, [form.target === 'pack' ? 'pack_id' : 'sku_id']: targetId, stock_flash: form.stock_flash || undefined };
        const { data } = await getFlashCeiling(params);
        setCeiling(data.data);
      } catch (err) {
        setCeiling({ ceiling: null, errors: [apiError(err)], warnings: [] });
      } finally { setCeilingLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [id, form.node_id, form.target, targetId, form.stock_flash]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const referencePrice = ceiling?.reference_price ?? item?.reference_price ?? null;
  const discountPct = useMemo(() => {
    const p = Number(form.flash_price);
    if (!referencePrice || form.flash_price === '' || !Number.isFinite(p)) return null;
    return Math.round((1 - p / referencePrice) * 100);
  }, [form.flash_price, referencePrice]);

  const currentOptions = form.target === 'pack' ? options.packs : options.skus;

  function pickTarget(opt) {
    if (form.target === 'pack') setForm((f) => ({ ...f, pack_id: opt.id, sku_id: '', target_label: opt.name_fr }));
    else setForm((f) => ({ ...f, sku_id: opt.id, pack_id: '', target_label: `${opt.name_fr} (${opt.sku_code})` }));
    setTargetSearch('');
  }

  function clientValidate() {
    if (!form.node_id) return 'Sélectionnez le node';
    if (!targetId) return form.target === 'pack' ? 'Sélectionnez le pack' : 'Sélectionnez le produit (SKU)';
    const price = Number(form.flash_price);
    if (form.flash_price === '' || !Number.isFinite(price) || price < 0) return 'Le prix flash doit être supérieur ou égal à 0';
    const stock = Number(form.stock_flash);
    if (!Number.isInteger(stock) || stock < 1) return 'Le plafond flash doit être un entier ≥ 1';
    const maxQty = Number(form.max_qty_per_user);
    if (!Number.isInteger(maxQty) || maxQty < 1) return 'La quantité max par client doit être un entier ≥ 1';
    if (!form.starts_at || !form.ends_at) return 'Les dates de début et de fin sont obligatoires';
    if (new Date(form.ends_at) <= new Date(form.starts_at)) return 'La date de fin doit être postérieure à la date de début';
    return null;
  }

  async function handleSave() {
    const msg = clientValidate();
    if (msg) { setError(msg); return; }
    setSaving(true); setError(null); setSuccess(null);
    try {
      const payload = {
        name_fr: form.name_fr,
        name_ar: form.name_ar,
        flash_price: form.flash_price,
        stock_flash: form.stock_flash,
        max_qty_per_user: form.max_qty_per_user,
        ends_at: fromLocalInput(form.ends_at),
        ...(image && { image }),
      };
      if (isNew || !started) payload.starts_at = fromLocalInput(form.starts_at);
      let res;
      if (isNew) {
        res = await createFlashSale({
          ...payload,
          node_id: form.node_id,
          ...(form.target === 'pack' ? { pack_id: form.pack_id } : { sku_id: form.sku_id }),
          is_active: false,
        });
      } else {
        res = await updateFlashSale(id, payload);
      }
      const saved = res.data.data;
      setWarnings(saved.warnings ?? []);
      setSuccess(isNew
        ? 'Vente flash enregistrée (inactive). Cliquez sur « Activer » pour la lancer : elle sera visible dans l\'app à partir de sa date de début.'
        : 'Modifications enregistrées.');
      setImage(null); setPreview(null);
      onSaved?.(saved, isNew);
      if (!isNew) {
        const { data } = await getFlashSale(id);
        setItem(data.data); setForm(fromItem(data.data));
      }
    } catch (err) {
      setError(apiError(err));
    } finally { setSaving(false); }
  }

  async function handleToggle() {
    if (!item) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const { data } = await setFlashSaleActive(item.id, !item.is_active);
      const fresh = await getFlashSale(item.id);
      setItem(fresh.data.data);
      setSuccess(data.data.is_active ? 'Vente flash activée.' : 'Vente flash désactivée : la carte flash disparaît, le prix normal reprend. Les commandes en cours ne sont pas affectées.');
      onSaved?.(fresh.data.data, false);
    } catch (err) { setError(apiError(err)); } finally { setSaving(false); }
  }

  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImage(f);
    setPreview(URL.createObjectURL(f));
  }

  if (loading) {
    return <div className="flex items-center gap-2 py-12 text-sm text-neutral-500"><Loader2 size={16} className="animate-spin" /> Chargement…</div>;
  }

  const imageUrl = preview ?? item?.image_url ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" className="btn-secondary" onClick={onBack}><ArrowLeft size={16} /> Liste</button>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{isNew ? 'Nouvelle flash sale' : (item?.name_fr ?? 'Vente flash')}</h2>
            {item && (
              <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                <FlashStatusBadge item={item} />
                <span>Créée le {formatDate(item.created_at)} · modifiée le {formatDate(item.updated_at)}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {item && !item.is_deleted && canManage && (
            <button type="button" className="btn-icon-delete px-3 py-2" onClick={() => onDelete?.(item)}><Trash2 size={15} /> Supprimer</button>
          )}
          {item && !item.is_deleted && canManage && (item.is_active || !item.is_expired) && (
            <button type="button" className="btn-secondary" disabled={saving} onClick={handleToggle}>
              {item.is_active ? <><PowerOff size={16} /> Désactiver</> : <><Power size={16} /> Activer</>}
            </button>
          )}
          {!readOnly && (
            <button type="button" className={primaryBtn} disabled={saving} onClick={handleSave}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer
            </button>
          )}
        </div>
      </div>

      {error && <Notice tone="red">{error}</Notice>}
      {success && <Notice tone="green">{success}</Notice>}
      {item?.is_deleted && <Notice tone="zinc">Vente flash supprimée le {formatDate(item.deleted_at)} : lecture seule (historique). Le compteur de ventes reste consultable.</Notice>}
      {item && !item.is_deleted && item.is_expired && <Notice tone="zinc">Vente flash terminée (date de fin dépassée) : lecture seule. Pour relancer une promotion, créez une nouvelle vente flash.</Notice>}
      {item && !item.read_only && (
        <Notice tone="blue">
          Le node et la cible ne sont jamais modifiables après création. {started ? 'La vente a démarré : la date de début est figée.' : ''}
          {' '}Rappel : stock_flash est un plafond commercial (quota au prix flash), jamais un stock supplémentaire.
        </Notice>
      )}
      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w) => <Notice key={w}><span className="inline-flex gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{w}</span></Notice>)}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card space-y-4 lg:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Cible</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Node" required hint="Une vente flash est toujours rattachée à un node.">
              <select className="form-select" value={form.node_id} disabled={!isNew || readOnly}
                onChange={(e) => setForm((f) => ({ ...f, node_id: e.target.value, sku_id: '', pack_id: '', target_label: '' }))}>
                <option value="">— Choisir un node —</option>
                {nodes.map((n) => <option key={n.id} value={n.id}>{n.name_fr} ({n.code})</option>)}
              </select>
            </Field>
            <Field label="Type de cible" required>
              <div className="flex gap-4 pt-2 text-sm">
                {[{ v: 'sku', l: 'Produit (SKU)' }, { v: 'pack', l: 'Pack' }].map((o) => (
                  <label key={o.v} className="flex items-center gap-2">
                    <input type="radio" name="flash-target" value={o.v} checked={form.target === o.v} disabled={!isNew || readOnly}
                      onChange={() => setForm((f) => ({ ...f, target: o.v, sku_id: '', pack_id: '', target_label: '' }))} />
                    {o.l}
                  </label>
                ))}
              </div>
            </Field>
            <Field label={form.target === 'pack' ? 'Pack du node' : 'Produit du node'} required className="md:col-span-2">
              {targetId ? (
                <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
                  <span>{form.target_label || targetId}</span>
                  {isNew && !readOnly && (
                    <button type="button" className="text-xs text-red-600 hover:underline"
                      onClick={() => setForm((f) => ({ ...f, sku_id: '', pack_id: '', target_label: '' }))}>Changer</button>
                  )}
                </div>
              ) : (
                <div>
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input className="form-input pl-9" disabled={!form.node_id || readOnly}
                      placeholder={form.node_id ? 'Rechercher (nom, code, EAN)…' : 'Choisissez d\'abord un node'}
                      value={targetSearch} onChange={(e) => setTargetSearch(e.target.value)} />
                  </div>
                  {form.node_id && (
                    <div className="mt-1 max-h-56 overflow-auto rounded-lg border border-neutral-200 bg-white">
                      {optLoading && <div className="px-3 py-2 text-xs text-neutral-500">Recherche…</div>}
                      {!optLoading && currentOptions.length === 0 && (
                        <div className="px-3 py-2 text-xs text-neutral-400">{form.target === 'pack' ? 'Aucun pack sur ce node.' : 'Aucun produit paramétré sur ce node.'}</div>
                      )}
                      {currentOptions.map((o) => (
                        <button key={o.id} type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50" onClick={() => pickTarget(o)}>
                          <span>
                            <span className="font-medium">{o.name_fr}</span>
                            {o.sku_code && <span className="ml-2 text-xs text-neutral-400">{o.sku_code}</span>}
                            {o.is_active === false && <span className="ml-2 text-xs text-amber-600">inactif</span>}
                          </span>
                          <span className="text-xs text-neutral-500">
                            {money(o.reference_price)}
                            {form.target === 'sku' && ` · dispo ${o.qty_available}${o.is_backorderable ? ' · rupture autorisée' : ''}`}
                            {form.target === 'pack' && (o.max_pack_qty != null ? ` · max ${o.max_pack_qty}` : '')}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Field>
          </div>

          <h3 className="pt-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Prix & plafond</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Prix flash (MAD)" required hint={referencePrice != null ? `Prix normal : ${money(referencePrice)}${discountPct != null ? ` · remise ${discountPct} %` : ''}` : 'Sélectionnez la cible pour voir le prix normal.'}>
              <input type="number" min="0" step="0.01" className="form-input" value={form.flash_price} disabled={readOnly}
                onChange={(e) => set('flash_price', e.target.value)} />
            </Field>
            <Field label={`Plafond flash (stock_flash${form.target === 'pack' ? ', en packs entiers' : ''})`} required
              hint="Quota d'unités vendues au prix flash — prélevé sur le stock réel, jamais en plus.">
              <input type="number" min={item?.sold_count || 1} step="1" className="form-input" value={form.stock_flash} disabled={readOnly}
                onChange={(e) => set('stock_flash', e.target.value)} />
            </Field>
            <Field label="Quantité max par client" required>
              <input type="number" min="1" step="1" className="form-input" value={form.max_qty_per_user} disabled={readOnly}
                onChange={(e) => set('max_qty_per_user', e.target.value)} />
            </Field>
          </div>
          <CeilingPanel data={ceiling} loading={ceilingLoading} />

          <h3 className="pt-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Plage horaire</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Début (starts_at)" required hint={started && !isNew ? 'Figée : la vente a démarré.' : undefined}>
              <input type="datetime-local" className="form-input" value={form.starts_at} disabled={readOnly || (started && !isNew)}
                onChange={(e) => set('starts_at', e.target.value)} />
            </Field>
            <Field label="Fin (ends_at)" required hint="Doit être postérieure au début. Une date passée termine immédiatement la vente.">
              <input type="datetime-local" className="form-input" value={form.ends_at} disabled={readOnly}
                onChange={(e) => set('ends_at', e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Bannière</h3>
            <Field label="Nom (FR)" hint="Vide = nom du produit / pack.">
              <input className="form-input" value={form.name_fr} disabled={readOnly} onChange={(e) => set('name_fr', e.target.value)} />
            </Field>
            <Field label="الاسم (AR)">
              <input className="form-input text-right" dir="rtl" value={form.name_ar} disabled={readOnly} onChange={(e) => set('name_ar', e.target.value)} />
            </Field>
            <div>
              <label className="form-label">Image bannière</label>
              <div className="flex items-center gap-3">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-16 w-24 rounded-md object-cover" />
                ) : (
                  <div className="flex h-16 w-24 items-center justify-center rounded-md bg-neutral-100 text-neutral-300"><ImageOff size={18} /></div>
                )}
                {!readOnly && (
                  <>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
                    <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}><Upload size={15} /> Choisir</button>
                  </>
                )}
              </div>
            </div>
          </div>

          {item && (
            <div className="card space-y-2 text-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Suivi</h3>
              <div className="flex justify-between"><span className="text-neutral-500">Vendu au prix flash</span><strong>{item.sold_count}</strong></div>
              <div className="flex justify-between"><span className="text-neutral-500">Quota restant</span><strong>{item.remaining_quota}</strong></div>
              <div className="flex justify-between"><span className="text-neutral-500">Commandes actives liées</span><strong>{item.active_orders_count ?? 0}</strong></div>
              <div className="flex justify-between"><span className="text-neutral-500">Node</span><span>{item.node_name ?? '—'}</span></div>
              <p className="pt-1 text-xs text-neutral-400">Le compteur de ventes est piloté par les commandes : il n'est jamais saisissable.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
