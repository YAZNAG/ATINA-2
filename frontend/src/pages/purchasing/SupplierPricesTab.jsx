import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, RefreshCw, CalendarX, Ban, ClipboardList, Tag } from 'lucide-react';
import Modal from '../../components/Modal';
import {
  getSupplierPrices, createSupplierPrice, renegotiateSupplierPrice, updateSupplierPrice, deactivateSupplierPrice,
} from '../../api/purchasing.api';
import SkuSearchInput from './components/SkuSearchInput';
import {
  inputCls, btnPrimary, btnSecondary, iconBtn, Field, Pill, Spinner, Pagination,
} from './components/PurchasingUi';
import {
  errMsg, fmtPrice, fmtQty, fmtDate, todayIso, addDaysIso, downloadCsv, csvNum, VALIDITY_LABELS, skuLabel,
} from './purchasingUtils';

const VALIDITY_OPTIONS = [
  { value: '', label: 'Tous les prix actifs' },
  { value: 'current', label: 'En vigueur' },
  { value: 'future', label: 'À venir' },
  { value: 'expired', label: 'Expirés' },
  { value: 'inactive', label: 'Désactivés' },
];

const EMPTY_FORM = { supplier_id: '', sku: null, qty_min: '1', qty_max: '', price_ht: '', valid_from: '', valid_to: '' };

/**
 * Onglet « Prix fournisseurs (SKU) » : grille fournisseur × SKU (supplier_prices).
 * Paliers qty_min / qty_max, prix HT, validité ; une renégociation crée une nouvelle ligne.
 */
export default function SupplierPricesTab({
  suppliers = [], supplierId = '', onSupplierChange, initialSkuId = '', canCreate, canUpdate, canDeactivate, toast,
}) {
  const navigate = useNavigate();
  const [skuFilter, setSkuFilter] = useState(null);
  const [skuIdFilter, setSkuIdFilter] = useState(initialSkuId);
  const [validity, setValidity] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);

  const [modal, setModal] = useState(null); // { type: 'create'|'renegotiate'|'end', row }
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => { setSkuIdFilter(initialSkuId); }, [initialSkuId]);

  const effectiveSkuId = skuFilter?.id || skuIdFilter || '';
  const filters = {
    ...(supplierId && { supplier_id: supplierId }),
    ...(effectiveSkuId && { sku_id: effectiveSkuId }),
    ...(validity && { validity }),
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getSupplierPrices({ ...filters, page, limit: 50 });
      setRows(data.data || []);
      setPagination(data.pagination);
      if (!skuFilter && skuIdFilter && data.data?.[0]?.sku) setSkuFilter(data.data[0].sku);
    } catch (err) {
      toast?.('error', errMsg(err, 'Chargement des prix impossible'));
      setRows([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId, effectiveSkuId, validity, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [supplierId, effectiveSkuId, validity]);

  const exportCsv = async () => {
    try {
      const { data } = await getSupplierPrices({ ...filters, all: true });
      downloadCsv(`prix_fournisseurs_${todayIso()}.csv`,
        ['Code SKU', 'SKU', 'Code fournisseur', 'Fournisseur', 'Qté min', 'Qté max', 'Prix HT (MAD)', 'Début validité', 'Fin validité', 'Statut', 'Conditions de paiement'],
        (data.data || []).map((r) => [
          r.sku?.sku_code, r.sku?.name_fr, r.supplier?.code, r.supplier?.name_fr, csvNum(r.qty_min), csvNum(r.qty_max ?? ''),
          csvNum(r.price_ht), r.valid_from, r.valid_to || '', VALIDITY_LABELS[r.validity_status]?.label, r.supplier?.payment_terms || '',
        ]));
    } catch (err) {
      toast?.('error', errMsg(err, 'Export impossible'));
    }
  };

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, supplier_id: supplierId || '', sku: skuFilter || null, valid_from: todayIso() });
    setFormError('');
    setModal({ type: 'create' });
  };

  const openRenegotiate = (row) => {
    const minStart = addDaysIso(row.valid_from, 1);
    const start = todayIso() > minStart ? todayIso() : minStart;
    setForm({
      ...EMPTY_FORM, supplier_id: row.supplier_id, sku: row.sku, qty_min: String(row.qty_min ?? 1),
      qty_max: row.qty_max == null ? '' : String(row.qty_max), price_ht: String(row.price_ht ?? ''), valid_from: start, valid_to: '',
    });
    setFormError('');
    setModal({ type: 'renegotiate', row });
  };

  const openEnd = (row) => {
    setForm({ ...EMPTY_FORM, valid_to: row.valid_to || todayIso() });
    setFormError('');
    setModal({ type: 'end', row });
  };

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e?.preventDefault();
    setFormError('');
    const payload = {
      qty_min: form.qty_min === '' ? 1 : form.qty_min,
      qty_max: form.qty_max === '' ? null : form.qty_max,
      price_ht: form.price_ht,
      valid_from: form.valid_from || undefined,
      valid_to: form.valid_to || null,
    };
    setSaving(true);
    try {
      if (modal.type === 'create') {
        if (!form.supplier_id) throw new Error('Choisissez un fournisseur');
        if (!form.sku) throw new Error('Choisissez un SKU');
        if (form.price_ht === '') throw new Error('Saisissez le prix HT');
        await createSupplierPrice({ ...payload, supplier_id: form.supplier_id, sku_id: form.sku.id });
        toast?.('success', 'Prix fournisseur enregistré');
      } else if (modal.type === 'renegotiate') {
        if (form.price_ht === '') throw new Error('Saisissez le nouveau prix HT');
        await renegotiateSupplierPrice(modal.row.id, payload);
        toast?.('success', 'Nouveau prix enregistré ; l\'ancien est conservé dans l\'historique');
      } else if (modal.type === 'end') {
        await updateSupplierPrice(modal.row.id, { valid_to: form.valid_to || null });
        toast?.('success', 'Fin de validité mise à jour');
      }
      setModal(null);
      load();
    } catch (err) {
      setFormError(errMsg(err, 'Enregistrement impossible'));
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (row) => {
    if (!window.confirm(`Désactiver ce prix (${row.sku?.sku_code} · ${row.supplier?.name_fr}) ?`)) return;
    try {
      await deactivateSupplierPrice(row.id);
      toast?.('success', 'Prix désactivé');
      load();
    } catch (err) {
      toast?.('error', errMsg(err, 'Désactivation impossible'));
    }
  };

  const goOrders = () => {
    const qs = new URLSearchParams({ ...(supplierId && { supplier_id: supplierId }), ...(effectiveSkuId && { sku_id: effectiveSkuId }) });
    navigate(`/purchasing/purchase-orders${qs.toString() ? `?${qs}` : ''}`);
  };

  const supplierName = suppliers.find((s) => s.id === supplierId)?.name_fr;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Fournisseur" className="min-w-[220px]">
          <select value={supplierId} onChange={(e) => onSupplierChange?.(e.target.value)} className={inputCls}>
            <option value="">Tous les fournisseurs</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name_fr}{s.code ? ` (${s.code})` : ''}{s.status && s.status !== 'active' ? ' — inactif' : ''}</option>
            ))}
          </select>
        </Field>
        <Field label="SKU" className="min-w-[280px] flex-1">
          {!skuFilter && skuIdFilter ? (
            <button type="button" onClick={() => setSkuIdFilter('')} className={`${inputCls} text-left text-neutral-600`} title="Retirer le filtre SKU">
              Filtre sur le SKU de la fiche produit — cliquer pour retirer
            </button>
          ) : (
            <SkuSearchInput value={skuFilter} onSelect={(s) => { setSkuFilter(s); setSkuIdFilter(''); }} />
          )}
        </Field>
        <Field label="Validité" className="min-w-[180px]">
          <select value={validity} onChange={(e) => setValidity(e.target.value)} className={inputCls}>
            {VALIDITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={goOrders} className={btnSecondary}><ClipboardList size={16} /> Bons de commande</button>
          <button type="button" onClick={exportCsv} className={btnSecondary}><Download size={16} /> Exporter</button>
          {canCreate && <button type="button" onClick={openCreate} className={btnPrimary}><Plus size={16} /> Ajouter un prix</button>}
        </div>
      </div>

      <p className="text-xs text-neutral-400">
        Paliers : de « Qté min » à « Qté max » (vide = sans plafond) ; en cas de borne commune, le palier supérieur s'applique.
        Toute renégociation crée une nouvelle ligne et clôture l'ancienne à la veille de la nouvelle date d'effet.
      </p>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Fournisseur</th>
              <th className="px-4 py-3 font-medium text-right">Palier (qté)</th>
              <th className="px-4 py-3 font-medium text-right">Prix HT</th>
              <th className="px-4 py-3 font-medium">Validité</th>
              <th className="px-4 py-3 font-medium">Conditions</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={8}><Spinner /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-neutral-400">
                Aucun prix fournisseur{supplierName ? ` pour ${supplierName}` : ''}{skuFilter ? ` sur ${skuFilter.sku_code}` : ''}.
              </td></tr>
            ) : rows.map((r) => {
              const v = VALIDITY_LABELS[r.validity_status] || VALIDITY_LABELS.current;
              const editable = r.validity_status !== 'inactive';
              return (
                <tr key={r.id} className={`hover:bg-neutral-50 ${editable ? '' : 'opacity-60'}`}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-neutral-500">{r.sku?.sku_code}</p>
                    <p className="font-medium text-neutral-800">{r.sku?.name_fr}</p>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{r.supplier?.name_fr}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-700">
                    {fmtQty(r.qty_min)} → {r.qty_max == null ? '∞' : fmtQty(r.qty_max)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-neutral-900">{fmtPrice(r.price_ht)}</td>
                  <td className="px-4 py-3 text-xs text-neutral-600">
                    {fmtDate(r.valid_from)} → {r.valid_to ? fmtDate(r.valid_to) : 'sans fin'}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {r.supplier?.payment_terms || '—'}
                    {r.supplier?.lead_time_days != null && <span className="block">Délai : {r.supplier.lead_time_days} j</span>}
                  </td>
                  <td className="px-4 py-3"><Pill cls={v.cls}>{v.label}</Pill></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {canUpdate && editable && (
                        <>
                          <button type="button" className={iconBtn} title="Renégocier (nouvelle ligne de prix)" onClick={() => openRenegotiate(r)}><RefreshCw size={15} /></button>
                          <button type="button" className={iconBtn} title="Modifier la fin de validité" onClick={() => openEnd(r)}><CalendarX size={15} /></button>
                        </>
                      )}
                      {canDeactivate && editable && (
                        <button type="button" className="rounded-lg p-2 text-red-500 transition hover:bg-red-50" title="Désactiver" onClick={() => deactivate(r)}><Ban size={15} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination pagination={pagination} onPage={setPage} />

      <Modal
        open={!!modal}
        onClose={() => !saving && setModal(null)}
        size="md"
        title={modal?.type === 'create' ? 'Ajouter un prix fournisseur' : modal?.type === 'renegotiate' ? 'Renégocier le prix' : 'Fin de validité'}
        subtitle={modal?.row ? `${skuLabel(modal.row.sku)} · ${modal.row.supplier?.name_fr}` : undefined}
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setModal(null)} disabled={saving}>Annuler</button>
            <button type="button" className={btnPrimary} onClick={submit} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        )}
      >
        <form onSubmit={submit} className="space-y-4">
          {formError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
          {modal?.type === 'end' ? (
            <>
              <p className="text-sm text-neutral-500">
                Prix actuel : <strong>{fmtPrice(modal.row.price_ht)}</strong> depuis le {fmtDate(modal.row.valid_from)}.
                Laissez vide pour une validité sans fin.
              </p>
              <Field label="Date de fin de validité">
                <input type="date" value={form.valid_to} min={modal.row.valid_from} onChange={setF('valid_to')} className={inputCls} />
              </Field>
            </>
          ) : (
            <>
              {modal?.type === 'create' && (
                <>
                  <Field label="Fournisseur" required>
                    <select value={form.supplier_id} onChange={setF('supplier_id')} className={inputCls}>
                      <option value="">— Choisir —</option>
                      {suppliers.filter((s) => !s.status || s.status === 'active').map((s) => (
                        <option key={s.id} value={s.id}>{s.name_fr}{s.code ? ` (${s.code})` : ''}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="SKU" required>
                    <SkuSearchInput value={form.sku} onSelect={(s) => setForm((f) => ({ ...f, sku: s }))} />
                  </Field>
                </>
              )}
              {modal?.type === 'renegotiate' && (
                <div className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
                  <Tag size={14} /> Ancien prix : <strong>{fmtPrice(modal.row.price_ht)}</strong> — il sera clôturé à la veille de la nouvelle date d'effet.
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Qté min" required hint="Unité d'achat">
                  <input type="number" min="0" step="0.001" value={form.qty_min} onChange={setF('qty_min')} className={inputCls} />
                </Field>
                <Field label="Qté max" hint="Vide = sans plafond">
                  <input type="number" min="0" step="0.001" value={form.qty_max} onChange={setF('qty_max')} className={inputCls} />
                </Field>
              </div>
              <Field label={modal?.type === 'renegotiate' ? 'Nouveau prix HT unitaire (MAD)' : 'Prix HT unitaire (MAD)'} required>
                <input type="number" min="0" step="0.0001" value={form.price_ht} onChange={setF('price_ht')} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={modal?.type === 'renegotiate' ? "Date d'effet" : 'Début de validité'} required>
                  <input type="date" value={form.valid_from} onChange={setF('valid_from')} className={inputCls} />
                </Field>
                <Field label="Fin de validité" hint="Vide = sans fin">
                  <input type="date" value={form.valid_to} min={form.valid_from || undefined} onChange={setF('valid_to')} className={inputCls} />
                </Field>
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
