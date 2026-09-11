import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowDown, ArrowUp, Copy, ImageOff, Lock, Package, Plus, Save, Trash2 } from 'lucide-react';
import { getPack, createPack, updatePack, activatePack, deactivatePack, getPackEligibleSkus } from '../../../api/packs.api';
import { DuplicatePackModal, DeletePackModal } from './PackDialogs';
import { money, nodeLabel, apiError, StatusBadge, VisibilityBadge, ComponentBadge, Toggle, formatDateTime } from './packUi';

/**
 * Onglet « Détail pack & composition » (WF #16, US-071, US-072, US-099, US-100).
 * Création (packId = null) ou édition d'un pack existant.
 */

function toDateInput(d) {
  if (!d) return '';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function emptyForm(nodeId) {
  return {
    node_id: nodeId ?? '',
    name_fr: '', name_ar: '',
    description_fr: '', description_ar: '',
    image_url: '',
    valid_from: '', valid_to: '',
    total_price: '',
    max_pack_qty: '',
    is_backorderable: false,
    estimated_restock_days: 1,
    is_active: false,
    items: [],
  };
}

function formFromPack(p) {
  return {
    node_id: p.node_id ?? '',
    name_fr: p.name_fr ?? '', name_ar: p.name_ar ?? '',
    description_fr: p.description_fr ?? '', description_ar: p.description_ar ?? '',
    image_url: p.image_url ?? '',
    valid_from: toDateInput(p.valid_from), valid_to: toDateInput(p.valid_to),
    total_price: p.total_price ?? '',
    max_pack_qty: p.max_pack_qty ?? '',
    is_backorderable: !!p.is_backorderable,
    estimated_restock_days: p.estimated_restock_days ?? 1,
    is_active: !!p.is_active,
    items: (p.items ?? []).map((it) => ({
      sku_id: it.sku_id,
      sku_code: it.sku_code,
      name_fr: it.name_fr,
      qty: it.qty,
      unit_price_in_pack: it.unit_price_in_pack ?? it.unit_price,
      catalog_price: it.catalog_price,
      stock_available: it.stock_available,
      component_status: it.component_status,
      component_status_label: it.component_status_label,
    })),
  };
}

const BLOCKING = ['absent', 'inactif', 'non_vendable'];

/** État d'un composant : statut serveur bloquant, sinon recalcul local (stock vs quantité saisie). */
function localStatus(it) {
  if (BLOCKING.includes(it.component_status)) return { code: it.component_status, label: it.component_status_label };
  if (it.has_selling_rule === true && it.is_sellable === false) return { code: 'non_vendable', label: 'Non vendable sur ce node' };
  if (it.stock_available !== undefined && Number(it.stock_available) < Number(it.qty || 0)) return { code: 'rupture', label: 'Stock insuffisant' };
  return { code: 'ok', label: 'Disponible' };
}

export default function PackDetail({
  packId, nodes = [], defaultNodeId = null, perms = {}, onSaved, onDeleted, onOpenPack,
}) {
  const { canCreate = false, canUpdate = false, canDelete = false } = perms;
  const isNew = !packId;
  const canEdit = isNew ? canCreate : canUpdate;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [pack, setPack] = useState(null);
  const [form, setForm] = useState(emptyForm(defaultNodeId));

  const [skuSearch, setSkuSearch] = useState('');
  const [skuOptions, setSkuOptions] = useState([]);
  const [selectedSkuId, setSelectedSkuId] = useState('');
  const [addQty, setAddQty] = useState(1);

  const [dupOpen, setDupOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  // ── Chargement ────────────────────────────────────────────────────────────
  useEffect(() => {
    setError(null);
    setInfo(null);
    if (isNew) {
      setPack(null);
      setForm(emptyForm(defaultNodeId));
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    getPack(packId)
      .then(({ data }) => {
        if (cancelled) return;
        const p = data.data;
        setPack(p);
        setForm(formFromPack(p));
      })
      .catch((err) => !cancelled && setError(apiError(err, 'Impossible de charger le pack')))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [packId, isNew, defaultNodeId]);

  // ── SKU proposables (même node que le pack) ───────────────────────────────
  useEffect(() => {
    if (!form.node_id || !canEdit) { setSkuOptions([]); return undefined; }
    const t = setTimeout(() => {
      getPackEligibleSkus({ node_id: form.node_id, search: skuSearch || undefined, limit: 30 })
        .then(({ data }) => setSkuOptions(data.data ?? []))
        .catch(() => setSkuOptions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [form.node_id, skuSearch, canEdit]);

  const lock = pack?.composition_lock;
  const locked = !!lock?.locked;
  const canEditRecipe = canEdit && !locked;

  const originalPrice = useMemo(
    () => Math.round(form.items.reduce((s, it) => s + Number(it.unit_price_in_pack || 0) * Number(it.qty || 0), 0) * 100) / 100,
    [form.items],
  );
  const packPrice = Number(form.total_price || 0);
  const discountPct = originalPrice > 0 && packPrice > 0 ? Math.round((1 - packPrice / originalPrice) * 10000) / 100 : 0;

  const itemsWithStatus = form.items.map((it) => ({ ...it, status: localStatus(it) }));
  const problemItems = itemsWithStatus.filter((it) => it.status.code !== 'ok');

  const soldCount = pack?.sold_count ?? 0;
  const remainingCap = form.max_pack_qty === '' || form.max_pack_qty === null ? null : Math.max(0, Number(form.max_pack_qty) - soldCount);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  function updateItem(skuId, patch) {
    setForm((f) => ({ ...f, items: f.items.map((it) => (it.sku_id === skuId ? { ...it, ...patch } : it)) }));
  }

  function moveItem(index, dir) {
    setForm((f) => {
      const items = [...f.items];
      const j = index + dir;
      if (j < 0 || j >= items.length) return f;
      [items[index], items[j]] = [items[j], items[index]];
      return { ...f, items };
    });
  }

  function removeItem(skuId) {
    setForm((f) => ({ ...f, items: f.items.filter((it) => it.sku_id !== skuId) }));
  }

  function addItem() {
    if (!selectedSkuId) return;
    if (form.items.some((it) => it.sku_id === selectedSkuId)) { setError('Ce SKU est déjà présent dans la recette'); return; }
    const sku = skuOptions.find((s) => s.id === selectedSkuId);
    const qty = Number(addQty);
    if (!sku) return;
    if (!(qty > 0)) { setError('La quantité doit être strictement supérieure à 0'); return; }
    setError(null);
    setForm((f) => ({
      ...f,
      items: [...f.items, {
        sku_id: sku.id,
        sku_code: sku.sku_code,
        name_fr: sku.name_fr,
        qty,
        unit_price_in_pack: sku.price,
        catalog_price: sku.price,
        stock_available: sku.qty_available,
        is_sellable: sku.is_sellable,
        has_selling_rule: sku.has_selling_rule,
      }],
    }));
    setSelectedSkuId('');
    setAddQty(1);
  }

  function validate() {
    if (!form.node_id) return 'Node obligatoire : un pack est rattaché à un seul node';
    if (!form.name_fr.trim()) return 'Nom (FR) obligatoire';
    if (!form.name_ar.trim()) return 'Nom (AR) obligatoire';
    if (form.items.length === 0) return 'Ajoutez au moins un composant';
    if (form.items.some((it) => !(Number(it.qty) > 0))) return 'Chaque quantité doit être strictement supérieure à 0';
    if (!(packPrice > 0)) return 'Prix pack obligatoire (supérieur à 0)';
    if (packPrice > originalPrice) return `Le prix pack ne peut pas dépasser le prix original (${money(originalPrice)})`;
    if (form.max_pack_qty !== '' && Number(form.max_pack_qty) < soldCount) {
      return `Le plafond de vente ne peut pas être inférieur aux packs déjà vendus (${soldCount})`;
    }
    if (form.valid_from && form.valid_to && form.valid_to <= form.valid_from) return 'La date de fin doit être postérieure à la date de début';
    return null;
  }

  async function handleSave() {
    const v = validate();
    if (v) { setError(v); return; }
    setSaving(true);
    setError(null);
    setInfo(null);
    const payload = {
      name_fr: form.name_fr.trim(),
      name_ar: form.name_ar.trim(),
      description_fr: form.description_fr || null,
      description_ar: form.description_ar || null,
      image_url: form.image_url || null,
      valid_from: form.valid_from || null,
      valid_to: form.valid_to || null,
      total_price: packPrice,
      max_pack_qty: form.max_pack_qty === '' ? null : Number(form.max_pack_qty),
      is_backorderable: !!form.is_backorderable,
      estimated_restock_days: Number(form.estimated_restock_days || 1),
      items: form.items.map((it, idx) => ({
        sku_id: it.sku_id, qty: Number(it.qty), unit_price_in_pack: Number(it.unit_price_in_pack || 0), sort_order: idx,
      })),
    };
    if (isNew) { payload.node_id = form.node_id; payload.is_active = !!form.is_active; }
    try {
      const { data } = isNew ? await createPack(payload) : await updatePack(packId, payload);
      const saved = data.data;
      setInfo(isNew ? 'Pack créé' : 'Pack enregistré');
      if (!isNew) { setPack(saved); setForm(formFromPack(saved)); }
      onSaved?.(saved, { created: isNew });
    } catch (err) {
      const d = err?.response?.data;
      if (err?.response?.status === 409 && d?.data?.composition_lock) {
        setPack((p) => (p ? { ...p, composition_lock: d.data.composition_lock } : p));
      }
      setError(apiError(err, "Échec de l'enregistrement"));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(next) {
    if (!pack) return;
    setError(null);
    try {
      const { data } = next ? await activatePack(pack.id) : await deactivatePack(pack.id);
      setPack(data.data);
      setForm((f) => ({ ...f, is_active: !!data.data.is_active }));
      onSaved?.(data.data, { created: false });
    } catch (err) {
      setError(apiError(err, 'Échec du changement de statut'));
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  if (loading) return <div className="card py-12 text-center text-sm text-slate-400">Chargement…</div>;
  if (!isNew && !pack) {
    return <div className="card py-12 text-center text-sm text-red-500">{error || 'Pack introuvable'}</div>;
  }

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="card flex flex-col gap-3 !p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{isNew ? 'Nouveau pack' : pack.name_fr}</h2>
          {!isNew && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Node {nodeLabel(pack.node, nodes, pack.node_id)}</span>
              <StatusBadge active={pack.is_active} />
              <VisibilityBadge visible={pack.is_available} />
              <span>Créé le {formatDateTime(pack.created_at)}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isNew && canUpdate && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <Toggle checked={!!pack.is_active} onChange={handleToggleActive} />
              {pack.is_active ? 'Actif' : 'Inactif'}
            </label>
          )}
          {!isNew && canCreate && (
            <button type="button" className="btn-secondary" onClick={() => setDupOpen(true)}>
              <Copy size={16} /> Dupliquer vers un node
            </button>
          )}
          {!isNew && canDelete && (
            <button type="button" className="btn-icon-delete" title="Supprimer" onClick={() => setDelOpen(true)}>
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {info && <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</div>}

      {locked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="mb-1 flex items-center gap-2 font-semibold"><Lock size={16} /> Composition gelée</p>
          <ul className="list-disc space-y-1 pl-5">
            {lock.reasons.map((r, i) => (
              <li key={i}>
                {r.message}{' '}
                {r.link && (
                  <Link to={r.link} className="font-medium text-red-600 hover:underline">
                    {r.code === 'ACTIVE_ORDERS' ? 'Voir les commandes' : 'Voir la vente flash'}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            Restent modifiables : libellés, description, image, prix, période, plafond de vente et activation. Pour
            changer la recette, désactivez ce pack et créez-en un nouveau.
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Informations */}
        <div className="card space-y-4 !p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-700">Informations</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="form-label">Node *</label>
              <select className="form-select" value={form.node_id} disabled={!isNew || !canEdit} onChange={(e) => setForm((f) => ({ ...f, node_id: e.target.value, items: isNew ? [] : f.items }))}>
                <option value="">— Choisir le node —</option>
                {nodes.map((n) => <option key={n.id} value={n.id}>{nodeLabel(n)}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Un pack est strictement rattaché à un node (pas de pack global). {isNew ? 'Choisir le node vide la composition.' : 'Pour un autre node, utilisez « Dupliquer vers un node ».'}
              </p>
            </div>
            <div>
              <label className="form-label">Nom (FR) *</label>
              <input className="form-input" value={form.name_fr} disabled={!canEdit} onChange={set('name_fr')} />
            </div>
            <div>
              <label className="form-label">Nom (AR) *</label>
              <input className="form-input" dir="rtl" value={form.name_ar} disabled={!canEdit} onChange={set('name_ar')} />
            </div>
            <div>
              <label className="form-label">Description (FR)</label>
              <textarea className="form-textarea" value={form.description_fr} disabled={!canEdit} onChange={set('description_fr')} />
            </div>
            <div>
              <label className="form-label">Description (AR)</label>
              <textarea className="form-textarea" dir="rtl" value={form.description_ar} disabled={!canEdit} onChange={set('description_ar')} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Image du pack (URL, bannière app)</label>
              <input className="form-input" value={form.image_url} disabled={!canEdit} onChange={set('image_url')} placeholder="https://…" />
            </div>
            <div>
              <label className="form-label">Validité — début</label>
              <input type="date" className="form-input" value={form.valid_from} disabled={!canEdit} onChange={set('valid_from')} />
            </div>
            <div>
              <label className="form-label">Validité — fin (optionnel)</label>
              <input type="date" className="form-input" value={form.valid_to} disabled={!canEdit} onChange={set('valid_to')} />
            </div>
          </div>
        </div>

        {/* Prix & aperçu */}
        <div className="card space-y-4 !p-5">
          <h3 className="text-sm font-semibold text-slate-700">Prix & aperçu</h3>
          <div>
            <label className="form-label">Prix original (auto)</label>
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">{money(originalPrice)}</div>
            <p className="mt-1 text-xs text-slate-400">Somme des prix de contribution × quantités.</p>
          </div>
          <div>
            <label className="form-label">Prix pack (MAD) *</label>
            <input type="number" min="0" step="0.01" className="form-input" value={form.total_price} disabled={!canEdit} onChange={set('total_price')} />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-500">Remise (auto)</span>
            <span className={`font-semibold ${discountPct > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>{discountPct > 0 ? `-${discountPct} %` : '0 %'}</span>
          </div>
          {/* Aperçu app : vignette + prix barré + prix pack */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
              {form.image_url ? <img src={form.image_url} alt="" className="h-full w-full object-cover" /> : <ImageOff size={18} className="text-slate-400" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{form.name_fr || 'Nom du pack'}</p>
              <p className="text-sm">
                {originalPrice > packPrice && <span className="mr-2 text-slate-400 line-through">{money(originalPrice)}</span>}
                <span className="font-semibold text-red-600">{money(packPrice)}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Règles de vente */}
      <div className="card !p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">Règles de vente</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="form-label">Plafond de vente (max_pack_qty)</label>
            <input type="number" min={soldCount} className="form-input" value={form.max_pack_qty} disabled={!canEdit} onChange={set('max_pack_qty')} placeholder="Vide = pas de plafond" />
          </div>
          <div>
            <label className="form-label">Packs vendus (sold_count)</label>
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">{soldCount}</div>
            <p className="mt-1 text-xs text-slate-400">Piloté par les commandes, non modifiable.</p>
          </div>
          <div>
            <label className="form-label">Plafond restant</label>
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">{remainingCap === null ? 'Illimité' : remainingCap}</div>
          </div>
          <div>
            <label className="form-label">Statut</label>
            {isNew ? (
              <label className="flex items-center gap-2 py-2 text-sm text-slate-600">
                <Toggle checked={form.is_active} disabled={!canEdit} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
                {form.is_active ? 'Actif' : 'Inactif (recommandé avant vérification)'}
              </label>
            ) : (
              <div className="py-2"><StatusBadge active={pack.is_active} /></div>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-800">Vente en rupture (is_backorderable)</p>
            <p className="text-xs text-slate-500">Override total des règles SKU : le pack reste vendable même sans stock ; le plafond de vente reste bloquant.</p>
          </div>
          <div className="flex items-center gap-3">
            <Toggle checked={form.is_backorderable} disabled={!canEdit} onChange={(v) => setForm((f) => ({ ...f, is_backorderable: v }))} />
            {form.is_backorderable && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                Réappro estimé
                <input type="number" min="0" className="form-input !w-20 !py-1.5" value={form.estimated_restock_days} disabled={!canEdit} onChange={set('estimated_restock_days')} />
                jour(s)
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Composition */}
      <div className="table-wrap">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Package size={16} /> Composition (SKU / quantité) *</p>
          {!isNew && (
            <p className="text-xs text-slate-500">
              Packs assemblables (calcul à la volée, sans réservation) : <strong className="text-slate-800">{pack.assemblable_count}</strong>
            </p>
          )}
        </div>

        {problemItems.length > 0 && (
          <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              Composant(s) en rupture ou non vendable(s) sur ce node : {problemItems.map((it) => `${it.sku_code} (${it.status.label})`).join(', ')}.
              {!form.is_backorderable && ' Le pack sera masqué côté app tant qu\'aucun pack n\'est assemblable.'}
            </span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="table-th w-16">Ordre</th>
                <th className="table-th">SKU</th>
                <th className="table-th">Qté *</th>
                <th className="table-th">Prix contribution</th>
                <th className="table-th">Total ligne</th>
                <th className="table-th">Stock dispo</th>
                <th className="table-th">Assemblables</th>
                <th className="table-th">État</th>
                {canEditRecipe && <th className="table-th" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itemsWithStatus.map((it, idx) => (
                <tr key={it.sku_id}>
                  <td className="table-td">
                    <div className="flex gap-1">
                      <button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" disabled={!canEdit || idx === 0} onClick={() => moveItem(idx, -1)} title="Monter"><ArrowUp size={14} /></button>
                      <button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" disabled={!canEdit || idx === form.items.length - 1} onClick={() => moveItem(idx, 1)} title="Descendre"><ArrowDown size={14} /></button>
                    </div>
                  </td>
                  <td className="table-td">
                    <div className="font-medium text-slate-800">{it.name_fr}</div>
                    <div className="text-xs text-slate-400">{it.sku_code}</div>
                  </td>
                  <td className="table-td">
                    <input type="number" min="0.001" step="any" className="form-input !w-20 !py-1.5" value={it.qty} disabled={!canEditRecipe} onChange={(e) => updateItem(it.sku_id, { qty: e.target.value })} />
                  </td>
                  <td className="table-td">
                    <input type="number" min="0" step="0.01" className="form-input !w-28 !py-1.5" value={it.unit_price_in_pack} disabled={!canEdit} onChange={(e) => updateItem(it.sku_id, { unit_price_in_pack: e.target.value })} />
                    {it.catalog_price !== undefined && <div className="mt-0.5 text-xs text-slate-400">Catalogue : {money(it.catalog_price)}</div>}
                  </td>
                  <td className="table-td">{money(Number(it.unit_price_in_pack || 0) * Number(it.qty || 0))}</td>
                  <td className="table-td">{it.stock_available ?? '—'}</td>
                  <td className="table-td">{it.stock_available !== undefined && Number(it.qty) > 0 ? Math.floor(Number(it.stock_available) / Number(it.qty)) : '—'}</td>
                  <td className="table-td"><ComponentBadge code={it.status.code} label={it.status.label} /></td>
                  {canEditRecipe && (
                    <td className="table-td text-right">
                      <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => removeItem(it.sku_id)}>Retirer</button>
                    </td>
                  )}
                </tr>
              ))}
              {form.items.length === 0 && (
                <tr><td colSpan={9} className="table-td py-8 text-center text-slate-400">Aucun composant. Choisissez le node puis ajoutez des SKU.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {canEditRecipe && (
          <div className="flex flex-col gap-2 border-t border-slate-200 p-3 sm:flex-row sm:items-center">
            <input className="form-input sm:!w-56" placeholder="Rechercher un SKU du node…" value={skuSearch} disabled={!form.node_id} onChange={(e) => setSkuSearch(e.target.value)} />
            <select className="form-select flex-1" value={selectedSkuId} disabled={!form.node_id} onChange={(e) => setSelectedSkuId(e.target.value)}>
              <option value="">{form.node_id ? '— Choisir un SKU —' : 'Choisissez d\'abord le node'}</option>
              {skuOptions.filter((s) => !form.items.some((it) => it.sku_id === s.id)).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sku_code} — {s.name_fr} · stock {s.qty_available}{s.has_selling_rule && !s.is_sellable ? ' · non vendable' : ''}
                </option>
              ))}
            </select>
            <input type="number" min="1" className="form-input sm:!w-24" value={addQty} onChange={(e) => setAddQty(e.target.value)} placeholder="Qté" />
            <button type="button" className="btn-secondary" disabled={!selectedSkuId} onClick={addItem}><Plus size={16} /> Ajouter</button>
          </div>
        )}
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Save size={16} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      )}

      <DuplicatePackModal
        open={dupOpen}
        pack={pack}
        nodes={nodes}
        onClose={() => setDupOpen(false)}
        onDuplicated={(res) => onSaved?.(res.pack, { created: true, silent: true })}
        onOpenPack={(id) => { setDupOpen(false); onOpenPack?.(id); }}
      />
      <DeletePackModal
        open={delOpen}
        pack={pack}
        canDeactivate={canUpdate}
        onClose={() => setDelOpen(false)}
        onDeleted={(id) => onDeleted?.(id)}
        onDeactivated={(p) => { setPack((prev) => ({ ...prev, ...p })); setForm((f) => ({ ...f, is_active: false })); onSaved?.(p, { created: false }); }}
      />
    </div>
  );
}
