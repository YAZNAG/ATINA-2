import { useEffect, useMemo, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { getPack, createPack, updatePack, deletePack, duplicatePack } from '../../../api/offres.api';
import { getSkus } from '../../../api/catalog.api';

const TABS = [
  { key: 'detail', label: 'Détail & composition' },
  { key: 'availability', label: 'Disponibilité & assemblables' },
];

function money(n) {
  return `${Number(n ?? 0).toFixed(2)} MAD`;
}

function toDateInputValue(d) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatDateTime(d) {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function emptyForm(nodeId) {
  return {
    name_fr: '',
    name_ar: '',
    node_id: nodeId ?? '',
    total_price: '',
    max_pack_qty: '',
    valid_from: '',
    valid_to: '',
    is_backorderable: false,
    is_active: true,
    items: [], // { sku_id, sku_code, name_fr, price, qty, stock_available, assemblable }
  };
}

export default function PackDetailDrawer({ packId, nodes = [], defaultNodeId = null, onClose, onSaved }) {
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission('packs.update');
  const canCreate = hasPermission('packs.create');
  const canDelete = hasPermission('packs.delete');
  const isNew = !packId;
  // En création il faut canCreate ; en édition il faut canUpdate.
  const canEditFields = isNew ? canCreate : canUpdate;

  const [activeTab, setActiveTab] = useState('detail');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [pack, setPack] = useState(null); // dernière version connue du serveur (pour l'entête/statut)
  const [form, setForm] = useState(emptyForm(defaultNodeId));
  const [computedAt, setComputedAt] = useState(null); // horodatage du dernier calcul assemblable/vendable

  const [skuOptions, setSkuOptions] = useState([]);
  const [skuSearch, setSkuSearch] = useState('');
  const [selectedSkuId, setSelectedSkuId] = useState('');
  const [addQty, setAddQty] = useState(1);

  const [duplicateTarget, setDuplicateTarget] = useState('');
  const [duplicating, setDuplicating] = useState(false);

  // --- chargement du pack existant ---------------------------------------
  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPack(packId)
      .then(({ data }) => {
        if (cancelled) return;
        const p = data.data ?? data;
        setPack(p);
        setComputedAt(new Date());
        setForm({
          name_fr: p.name_fr ?? '',
          name_ar: p.name_ar ?? '',
          node_id: p.node_id ?? '',
          total_price: p.total_price ?? '',
          max_pack_qty: p.max_pack_qty ?? '',
          valid_from: toDateInputValue(p.valid_from),
          valid_to: toDateInputValue(p.valid_to),
          is_backorderable: !!p.is_backorderable,
          is_active: !!p.is_active,
          items: (p.items ?? []).map(it => ({
            sku_id: it.sku_id,
            sku_code: it.sku_code,
            name_fr: it.name_fr,
            price: it.unit_price,
            qty: it.qty,
            stock_available: it.stock_available,
            assemblable: it.assemblable,
          })),
        });
      })
      .catch(err => setError(err?.response?.data?.message ?? "Impossible de charger le pack"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [packId, isNew]);

  // --- recherche de SKU à ajouter -----------------------------------------
  useEffect(() => {
    const t = setTimeout(() => {
      getSkus({ search: skuSearch, limit: 20 })
        .then(({ data }) => setSkuOptions(data.data ?? data ?? []))
        .catch(() => setSkuOptions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [skuSearch]);

  const nodeLabel = useMemo(() => {
    const n = nodes.find(n => n.id === form.node_id);
    return n ? (n.code ?? n.name) : (form.node_id || '—');
  }, [nodes, form.node_id]);

  const composantsTotal = useMemo(
    () => form.items.reduce((sum, it) => sum + Number(it.price ?? 0) * Number(it.qty ?? 1), 0),
    [form.items]
  );

  const discountPct = composantsTotal > 0
    ? Math.round((1 - Number(form.total_price || composantsTotal) / composantsTotal) * 100)
    : 0;

  const outOfStockItems = useMemo(
    () => form.items.filter(it => Number(it.assemblable ?? 0) <= 0 && it.stock_available !== undefined),
    [form.items]
  );

  function updateItemQty(skuId, qty) {
    setForm(f => ({
      ...f,
      items: f.items.map(it => it.sku_id === skuId
        ? { ...it, qty: Math.max(1, Number(qty) || 1), assemblable: it.stock_available != null ? Math.floor(it.stock_available / Math.max(1, Number(qty) || 1)) : it.assemblable }
        : it),
    }));
  }

  function removeItem(skuId) {
    setForm(f => ({ ...f, items: f.items.filter(it => it.sku_id !== skuId) }));
  }

  function addItem() {
    if (!selectedSkuId) return;
    if (form.items.some(it => it.sku_id === selectedSkuId)) return; // déjà présent
    const sku = skuOptions.find(s => s.id === selectedSkuId);
    if (!sku) return;
    setForm(f => ({
      ...f,
      items: [...f.items, {
        sku_id: sku.id,
        sku_code: sku.sku_code,
        name_fr: sku.name_fr,
        price: sku.price,
        qty: Math.max(1, Number(addQty) || 1),
        stock_available: undefined,
        assemblable: undefined,
      }],
    }));
    setSelectedSkuId('');
    setAddQty(1);
  }

  function toggleBackorderable() {
    if (!canEditFields) return;
    setForm(f => ({ ...f, is_backorderable: !f.is_backorderable }));
  }

  async function handleSave() {
    if (!form.name_fr) { setError('Nom (FR) requis'); return; }
    if (!form.node_id) { setError('Nœud requis'); return; }
    if (form.items.length === 0) { setError('Ajoutez au moins un composant'); return; }

    setSaving(true);
    setError(null);
    const payload = {
      name_fr: form.name_fr,
      name_ar: form.name_ar || form.name_fr,
      node_id: form.node_id,
      discount_type: 'fixed',
      total_price: Number(form.total_price || composantsTotal),
      max_pack_qty: form.max_pack_qty === '' ? null : Number(form.max_pack_qty),
      valid_from: form.valid_from || null,
      valid_to: form.valid_to || null,
      is_backorderable: !!form.is_backorderable,
      is_active: !!form.is_active,
      items: form.items.map(it => ({ sku_id: it.sku_id, qty: it.qty })),
    };

    try {
      const res = isNew ? await createPack(payload) : await updatePack(packId, payload);
      const saved = res.data.data ?? res.data;
      onSaved?.(saved);
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.message ?? "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!pack) return;
    if (!window.confirm(`Supprimer le pack "${pack.name_fr}" ?`)) return;
    try {
      await deletePack(pack.id);
      onSaved?.({ deleted: pack.id });
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.message ?? "Échec de la suppression");
    }
  }

  async function handleToggleActive() {
    if (!pack) return;
    const next = !form.is_active;
    setForm(f => ({ ...f, is_active: next }));
    try {
      await updatePack(pack.id, { is_active: next });
      onSaved?.({ ...pack, is_active: next });
    } catch (err) {
      setForm(f => ({ ...f, is_active: !next }));
      setError(err?.response?.data?.message ?? "Échec de la mise à jour du statut");
    }
  }

  async function handleDuplicate() {
    if (!pack || !duplicateTarget) return;
    setDuplicating(true);
    setError(null);
    try {
      const res = await duplicatePack(pack.id, duplicateTarget);
      onSaved?.(res.data.data ?? res.data);
      setDuplicateTarget('');
    } catch (err) {
      setError(err?.response?.data?.message ?? "Échec de la duplication");
    } finally {
      setDuplicating(false);
    }
  }

  const assemblableCount = pack?.assemblable_count ?? null;
  const vendableCount = pack?.vendable_count ?? null;
  const isAvailable = pack?.is_available ?? false;
  const computedAtLabel = formatDateTime(computedAt);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* panel */}
      <div className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-xl">
        {/* header */}
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isNew ? 'Nouveau pack' : (pack?.name_fr || '…')}
            </h2>
            {!isNew && pack && (
              <p className="mt-1 text-xs text-gray-500">
                Node {nodeLabel} ·{' '}
                <span className={form.is_active ? 'text-emerald-600' : 'text-gray-400'}>
                  {form.is_active ? 'Actif' : 'Inactif'}
                </span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* tabs */}
        <div className="flex gap-1 border-b border-gray-100 px-6">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 transition ${
                activeTab === tab.key
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="py-12 text-center text-gray-400">Chargement…</div>
          ) : error && !pack && !isNew ? (
            <div className="py-12 text-center text-red-500">{error}</div>
          ) : activeTab === 'detail' ? (
            <div className="space-y-5">
              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
              )}

              <div className="rounded-xl border border-gray-200 p-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Nom (FR) *</label>
                    <input
                      value={form.name_fr}
                      disabled={!canEditFields}
                      onChange={(e) => setForm(f => ({ ...f, name_fr: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Nom (AR)</label>
                    <input
                      value={form.name_ar}
                      dir="rtl"
                      disabled={!canEditFields}
                      onChange={(e) => setForm(f => ({ ...f, name_ar: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Nœud (obligatoire) *</label>
                    <select
                      value={form.node_id}
                      disabled={!isNew || !canEditFields}
                      onChange={(e) => setForm(f => ({ ...f, node_id: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                    >
                      <option value="">— Choisir —</option>
                      {nodes.map(n => (
                        <option key={n.id} value={n.id}>{n.code ?? n.name}</option>
                      ))}
                    </select>
                    {!isNew && (
                      <p className="mt-1 text-xs text-gray-400">
                        Un pack est strictement rattaché à un node — utilisez « Dupliquer vers un node ».
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Prix pack (MAD) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.total_price}
                      disabled={!canEditFields}
                      onChange={(e) => setForm(f => ({ ...f, total_price: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">max_pack_qty</label>
                    <input
                      type="number"
                      min="0"
                      value={form.max_pack_qty}
                      disabled={!canEditFields}
                      onChange={(e) => setForm(f => ({ ...f, max_pack_qty: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                    />
                  </div>
                  <div />

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Période — début</label>
                    <input
                      type="date"
                      value={form.valid_from}
                      disabled={!canEditFields}
                      onChange={(e) => setForm(f => ({ ...f, valid_from: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Période — fin</label>
                    <input
                      type="date"
                      value={form.valid_to}
                      disabled={!canEditFields}
                      onChange={(e) => setForm(f => ({ ...f, valid_to: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">is_backorderable (override des règles SKU)</p>
                    <p className="text-xs text-gray-500">
                      Si activé, le pack reste vendable même en rupture ; estimated_restock_days pilote les créneaux.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.is_backorderable}
                    disabled={!canEditFields}
                    onClick={toggleBackorderable}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      form.is_backorderable ? 'bg-emerald-500' : 'bg-gray-300'
                    } ${!canEditFields ? 'opacity-50' : ''}`}
                  >
                    <span
                      className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                      style={{ transform: form.is_backorderable ? 'translateX(22px)' : 'translateX(4px)' }}
                    />
                  </button>
                </div>
              </div>

              {outOfStockItems.length > 0 && !form.is_backorderable && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    Composant(s) en rupture sur {nodeLabel} :{' '}
                    {outOfStockItems.map(it => `${it.name_fr} x${it.qty}`).join(', ')}.
                    Le pack sera masqué côté app si non-backorderable.
                  </span>
                </div>
              )}

              <div className="rounded-xl border border-gray-200">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-800">Composition (SKU / quantité) *</p>
                  <p className="text-sm">
                    <span className="text-gray-400">Composants : </span>
                    <span className="text-gray-400 line-through">{money(composantsTotal)}</span>{' '}
                    <span className="font-medium text-emerald-600">Pack : {money(form.total_price || composantsTotal)}</span>{' '}
                    <span className="text-emerald-600">-{Math.max(0, discountPct)}%</span>
                  </p>
                </div>

                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                      <th className="whitespace-nowrap px-4 py-2 font-medium">SKU</th>
                      <th className="whitespace-nowrap px-4 py-2 font-medium">Produit</th>
                      <th className="whitespace-nowrap px-4 py-2 font-medium">Prix</th>
                      <th className="whitespace-nowrap px-4 py-2 font-medium">Qté</th>
                      <th className="whitespace-nowrap px-4 py-2 font-medium">Stock</th>
                      <th className="whitespace-nowrap px-4 py-2 font-medium">Assemblables</th>
                      {canEditFields && <th className="whitespace-nowrap px-4 py-2 font-medium" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {form.items.map(it => {
                      const short = it.stock_available !== undefined && Number(it.assemblable ?? 0) <= 0;
                      return (
                        <tr key={it.sku_id} className={short ? 'bg-red-50/40' : ''}>
                          <td className="whitespace-nowrap px-4 py-2 text-gray-500">{it.sku_code}</td>
                          <td className="whitespace-nowrap px-4 py-2 text-gray-800">{it.name_fr}</td>
                          <td className="whitespace-nowrap px-4 py-2 text-gray-600">{money(it.price)}</td>
                          <td className="whitespace-nowrap px-4 py-2">
                            <input
                              type="number"
                              min="1"
                              value={it.qty}
                              disabled={!canEditFields}
                              onChange={(e) => updateItemQty(it.sku_id, e.target.value)}
                              className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm disabled:bg-gray-50"
                            />
                          </td>
                          <td className={`whitespace-nowrap px-4 py-2 ${short ? 'font-medium text-red-500' : 'text-gray-600'}`}>
                            {it.stock_available ?? '—'} {short && '⚠'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-gray-600">{it.assemblable ?? '—'}</td>
                          {canEditFields && (
                            <td className="whitespace-nowrap px-4 py-2 text-right">
                              <button onClick={() => removeItem(it.sku_id)} className="text-red-500 hover:text-red-600">
                                Retirer
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {form.items.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-gray-400">Aucun composant</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {canEditFields && (
                  <div className="flex items-center gap-2 border-t border-gray-100 p-3">
                    <select
                      value={selectedSkuId}
                      onChange={(e) => setSelectedSkuId(e.target.value)}
                      onFocus={() => skuOptions.length === 0 && setSkuSearch(s => s)}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <option value="">— Choisir un SKU —</option>
                      {skuOptions.map(s => (
                        <option key={s.id} value={s.id}>{s.sku_code} — {s.name_fr}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={addQty}
                      onChange={(e) => setAddQty(e.target.value)}
                      className="w-20 rounded-lg border border-gray-200 px-2 py-2 text-sm"
                      placeholder="Qté"
                    />
                    <button
                      onClick={addItem}
                      disabled={!selectedSkuId}
                      className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                    >
                      + Ajouter
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // --- onglet Disponibilité & assemblables ---------------------
            <div className="space-y-5">
              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
              )}

              {/* encart explicatif des formules */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-500">
                Assemblables = MIN( FLOOR(stock disponible / qté requise) ) sur les composants — calcul à la volée, sans réservation.
                Qté vendable = MIN(assemblables, max_pack_qty). is_available = backorderable OU assemblables ≥ 1 (recalcul temps réel).
              </div>

              {/* cartes de synthèse */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-200 p-4 text-center">
                  <p className={`text-2xl font-semibold ${assemblableCount > 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {assemblableCount ?? '—'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">Packs assemblables (calcul à la volée)</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4 text-center">
                  <p className={`text-2xl font-semibold ${vendableCount > 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {vendableCount ?? '—'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">Qté vendable = MIN(assemblables, max_pack_qty)</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4 text-center">
                  <p className={`text-lg font-semibold ${isAvailable ? 'text-emerald-600' : 'text-red-600'}`}>
                    {isAvailable ? 'Visible app' : 'Masqué côté app'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">is_available (temps réel)</p>
                </div>
              </div>

              {/* tableau des composants */}
              <div className="rounded-xl border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                      <th className="whitespace-nowrap px-4 py-2 font-medium">SKU</th>
                      <th className="whitespace-nowrap px-4 py-2 font-medium">Produit</th>
                      <th className="whitespace-nowrap px-4 py-2 font-medium">Qté / pack</th>
                      <th className="whitespace-nowrap px-4 py-2 font-medium">Stock dispo</th>
                      <th className="whitespace-nowrap px-4 py-2 font-medium">Assemblables</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {form.items.map(it => {
                      const short = it.stock_available !== undefined && Number(it.assemblable ?? 0) <= 0;
                      return (
                        <tr key={it.sku_id} className={short ? 'bg-red-50/40' : ''}>
                          <td className="whitespace-nowrap px-4 py-2 text-gray-500">{it.sku_code}</td>
                          <td className="whitespace-nowrap px-4 py-2 text-gray-800">{it.name_fr}</td>
                          <td className="whitespace-nowrap px-4 py-2 text-gray-600">{it.qty}</td>
                          <td className={`whitespace-nowrap px-4 py-2 ${short ? 'font-medium text-red-500' : 'text-gray-600'}`}>
                            {it.stock_available ?? '—'} {short && '⚠'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-gray-600">{it.assemblable ?? '—'}</td>
                        </tr>
                      );
                    })}
                    {form.items.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Aucun composant</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* toggle backorderable, accessible aussi depuis cet onglet */}
              <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-sm text-gray-800">Backorderable</p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.is_backorderable}
                  disabled={!canEditFields}
                  onClick={toggleBackorderable}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    form.is_backorderable ? 'bg-emerald-500' : 'bg-gray-300'
                  } ${!canEditFields ? 'opacity-50' : ''}`}
                >
                  <span
                    className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                    style={{ transform: form.is_backorderable ? 'translateX(22px)' : 'translateX(4px)' }}
                  />
                </button>
              </div>

              <p className="text-xs text-gray-400">
                {computedAtLabel
                  ? `Dernier recalcul : ${computedAtLabel}`
                  : 'Ces valeurs sont recalculées à chaque requête à partir du stock/des règles de vente courants — pas de réservation.'}
              </p>
            </div>
          )}
        </div>

        {/* footer */}
        {!loading && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              {canEditFields && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              )}

              {!isNew && canCreate && (
                <>
                  <select
                    value={duplicateTarget}
                    onChange={(e) => setDuplicateTarget(e.target.value)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600"
                  >
                    <option value="">Dupliquer vers un node…</option>
                    {nodes.filter(n => n.id !== form.node_id).map(n => (
                      <option key={n.id} value={n.id}>{n.code ?? n.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleDuplicate}
                    disabled={!duplicateTarget || duplicating}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {duplicating ? '…' : 'Dupliquer'}
                  </button>
                </>
              )}
            </div>

            {!isNew && (
              <div className="flex items-center gap-3">
                {canUpdate && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.is_active}
                    onClick={handleToggleActive}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      form.is_active ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                      style={{ transform: form.is_active ? 'translateX(22px)' : 'translateX(4px)' }}
                    />
                  </button>
                )}
                <span className="text-sm text-gray-500">{form.is_active ? 'Actif' : 'Inactif'}</span>
                {canDelete && (
                  <button onClick={handleDelete} className="text-sm font-medium text-red-500 hover:text-red-600">
                    Supprimer
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}