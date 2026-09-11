import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Download, Eye, Power, PowerOff, Trash2, RotateCcw, Lock, Truck, List, IdCard, Tag,
  ClipboardList, Save, Loader2, FilePlus2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getSuppliers, getSupplier, createSupplier, updateSupplier, toggleSupplierStatus, deleteSupplier, restoreSupplier,
} from '../../api/purchasing.api';
import SupplierPricesTab from './SupplierPricesTab';
import {
  useToast, TabBar, Pill, Field, Card, Spinner, EmptyState, InfoRow, Pagination,
  inputCls, btnPrimary, btnSecondary, btnDanger, iconBtn,
} from './components/PurchasingUi';
import { errMsg, fmtMoney, fmtDate, todayIso, downloadCsv, csvNum, SUPPLIER_STATUS } from './purchasingUtils';
import Modal from '../../components/Modal';

const TABS = [
  { key: 'list', label: 'Liste fournisseurs', icon: List },
  { key: 'detail', label: 'Fiche fournisseur', icon: IdCard },
  { key: 'prices', label: 'Prix fournisseurs (SKU)', icon: Tag },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
  { value: 'deleted', label: 'Supprimé' },
];

const EMPTY_FORM = {
  code: '', name_fr: '', name_ar: '', contact_name: '', contact_phone: '', contact_email: '', address: '',
  payment_terms: '', lead_time_days: '3', score: '', notes: '', is_active: true,
};

const toForm = (s) => ({
  code: s.code || '',
  name_fr: s.name_fr || '',
  name_ar: s.name_ar || '',
  contact_name: s.contact_name || '',
  contact_phone: s.contact_phone || '',
  contact_email: s.contact_email || '',
  address: s.address || '',
  payment_terms: s.payment_terms || '',
  lead_time_days: s.lead_time_days != null ? String(s.lead_time_days) : '',
  score: s.score != null ? String(s.score) : '',
  notes: s.notes || '',
  is_active: !!s.is_active,
});

function SupplierStatus({ s }) {
  const st = SUPPLIER_STATUS[s.status] || SUPPLIER_STATUS.active;
  return <Pill cls={st.cls}>{st.label}</Pill>;
}

export default function SuppliersPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canView = hasPermission('suppliers.view');
  const canCreate = hasPermission('suppliers.create');
  const canUpdate = hasPermission('suppliers.update');
  const canDelete = hasPermission('suppliers.delete');
  const canViewPo = hasPermission('purchase_orders.view');
  const canCreatePo = hasPermission('purchase_orders.create');
  const { show: toast, node: toastNode } = useToast();

  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'list';
  const selectedId = params.get('id') || '';
  const creating = params.get('new') === '1';
  const priceSupplierId = params.get('supplier_id') || '';
  const priceSkuId = params.get('sku_id') || '';

  const setQuery = useCallback((patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === null || v === undefined || v === '' ? next.delete(k) : next.set(k, v)));
    setParams(next, { replace: false });
  }, [params, setParams]);

  // ——— Liste ———
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);

  // Tous les fournisseurs (sélecteurs de l'onglet Prix)
  const [allSuppliers, setAllSuppliers] = useState([]);

  const loadList = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const { data } = await getSuppliers({ page, limit: 20, ...(search && { search }), ...(status && { status }) });
      setRows(data.data || []);
      setPagination(data.pagination);
    } catch (err) {
      toast('error', errMsg(err, 'Chargement des fournisseurs impossible'));
    } finally {
      setLoading(false);
    }
  }, [canView, page, search, status, toast]);

  const loadAll = useCallback(async () => {
    if (!canView) return;
    try {
      const { data } = await getSuppliers({ all: true });
      setAllSuppliers(data.data || []);
    } catch { setAllSuppliers([]); }
  }, [canView]);

  useEffect(() => {
    const t = setTimeout(loadList, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [loadList, search]);
  useEffect(() => { setPage(1); }, [search, status]);
  useEffect(() => { loadAll(); }, [loadAll]);

  const refreshAll = () => { loadList(); loadAll(); };

  const exportCsv = async () => {
    try {
      const { data } = await getSuppliers({ all: true, ...(search && { search }), ...(status && { status }) });
      downloadCsv(`fournisseurs_${todayIso()}.csv`,
        ['Code', 'Nom (FR)', 'Nom (AR)', 'Contact', 'Téléphone', 'E-mail', 'Adresse', 'Conditions de paiement', 'Délai (jours)', 'Score', 'BC en cours', 'Prix actifs', 'Statut'],
        (data.data || []).map((s) => [
          s.code, s.name_fr, s.name_ar, s.contact_name, s.contact_phone, s.contact_email, s.address, s.payment_terms,
          s.lead_time_days, csvNum(s.score ?? ''), s.open_po_count ?? 0, s.prices_count ?? 0, SUPPLIER_STATUS[s.status]?.label,
        ]));
    } catch (err) {
      toast('error', errMsg(err, 'Export impossible'));
    }
  };

  const openDetail = (s) => setQuery({ tab: 'detail', id: s.id, new: null });
  const openCreate = () => setQuery({ tab: 'detail', id: null, new: '1' });

  const toggle = async (s) => {
    setBusyId(s.id);
    try {
      const { data } = await toggleSupplierStatus(s.id);
      toast('success', data.message || 'Statut mis à jour');
      refreshAll();
    } catch (err) {
      toast('error', errMsg(err, 'Changement de statut impossible'));
    } finally {
      setBusyId(null);
    }
  };

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteSupplier(deleteTarget.id);
      toast('success', 'Fournisseur supprimé');
      if (selectedId === deleteTarget.id) setQuery({ tab: 'list', id: null });
      setDeleteTarget(null);
      refreshAll();
    } catch (err) {
      toast('error', errMsg(err, 'Suppression impossible'));
    } finally {
      setDeleting(false);
    }
  };

  const restore = async (s) => {
    setBusyId(s.id);
    try {
      await restoreSupplier(s.id);
      toast('success', 'Fournisseur restauré');
      refreshAll();
    } catch (err) {
      toast('error', errMsg(err, 'Restauration impossible'));
    } finally {
      setBusyId(null);
    }
  };

  if (!canView) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-neutral-400">
        <Lock size={28} />
        <p className="text-sm">Vous n'avez pas accès à cette page (permission suppliers.view requise).</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      {toastNode}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Fournisseurs</h1>
          <p className="mt-1 text-sm text-neutral-500">Référentiel fournisseurs, conditions commerciales et grille de prix d'achat par SKU.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canViewPo && (
            <button type="button" className={btnSecondary} onClick={() => navigate('/purchasing/purchase-orders')}>
              <ClipboardList size={16} /> Bons de commande
            </button>
          )}
          {canCreate && (
            <button type="button" className={btnPrimary} onClick={openCreate}><Plus size={16} /> Nouveau fournisseur</button>
          )}
        </div>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={(k) => setQuery({ tab: k })} />

      {tab === 'list' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] max-w-sm flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher (nom, code, contact, e-mail, téléphone)…"
                className={`${inputCls} py-2.5 pl-9`}
              />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} w-auto py-2.5`}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button type="button" className={`${btnSecondary} ml-auto`} onClick={exportCsv}><Download size={16} /> Exporter</button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Nom</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Conditions</th>
                  <th className="px-4 py-3 font-medium text-right">Score</th>
                  <th className="px-4 py-3 font-medium text-right">BC en cours</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <tr><td colSpan={8}><Spinner /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-neutral-400">
                    Aucun fournisseur trouvé.{canCreate && !search && !status ? ' Créez le premier avec « Nouveau fournisseur ».' : ''}
                  </td></tr>
                ) : rows.map((s) => {
                  const deleted = s.status === 'deleted';
                  return (
                    <tr key={s.id} className={`cursor-pointer transition hover:bg-neutral-50 ${deleted ? 'opacity-60' : ''}`} onClick={() => openDetail(s)}>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-500">{s.code || '—'}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-800">{s.name_fr}</p>
                        <p className="text-xs text-neutral-400" dir="rtl">{s.name_ar}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-600">
                        <p className="font-medium text-neutral-700">{s.contact_name || '—'}</p>
                        {s.contact_phone && <p>{s.contact_phone}</p>}
                        {s.contact_email && <p>{s.contact_email}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-600">
                        <p>{s.payment_terms || '—'}</p>
                        <p className="text-neutral-400">Délai : {s.lead_time_days ?? '—'} j</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{s.score ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {s.open_po_count ? <span className="font-semibold text-amber-600">{s.open_po_count}</span> : <span className="text-neutral-400">0</span>}
                      </td>
                      <td className="px-4 py-3"><SupplierStatus s={s} /></td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" className={iconBtn} title="Voir la fiche" onClick={() => openDetail(s)}><Eye size={16} /></button>
                          {!deleted && canUpdate && (
                            <button
                              type="button"
                              disabled={busyId === s.id}
                              onClick={() => toggle(s)}
                              title={s.is_active ? 'Désactiver' : 'Activer'}
                              className={`rounded-lg p-2 transition disabled:opacity-50 ${s.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-neutral-400 hover:bg-neutral-100'}`}
                            >
                              {busyId === s.id ? <Loader2 size={16} className="animate-spin" /> : s.is_active ? <Power size={16} /> : <PowerOff size={16} />}
                            </button>
                          )}
                          {!deleted && canDelete && (
                            <button type="button" className="rounded-lg p-2 text-red-500 transition hover:bg-red-50" title="Supprimer" onClick={() => setDeleteTarget(s)}>
                              <Trash2 size={16} />
                            </button>
                          )}
                          {deleted && canDelete && (
                            <button type="button" className={iconBtn} title="Restaurer" disabled={busyId === s.id} onClick={() => restore(s)}>
                              <RotateCcw size={16} />
                            </button>
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
        </div>
      )}

      {tab === 'detail' && (
        <SupplierSheet
          key={creating ? 'new' : selectedId || 'none'}
          supplierId={creating ? '' : selectedId}
          creating={creating}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canDelete={canDelete}
          canViewPo={canViewPo}
          canCreatePo={canCreatePo}
          toast={toast}
          onSaved={(s, wasNew) => { refreshAll(); if (wasNew) setQuery({ tab: 'detail', id: s.id, new: null }); }}
          onDelete={(s) => setDeleteTarget(s)}
          onCancel={() => setQuery({ tab: 'list', new: null })}
          onPrices={(s) => setQuery({ tab: 'prices', supplier_id: s.id })}
          onCreate={openCreate}
        />
      )}

      {tab === 'prices' && (
        <SupplierPricesTab
          suppliers={allSuppliers.filter((s) => s.status !== 'deleted')}
          supplierId={priceSupplierId}
          onSupplierChange={(id) => setQuery({ supplier_id: id })}
          initialSkuId={priceSkuId}
          canCreate={canCreate || canUpdate}
          canUpdate={canUpdate}
          canDeactivate={canUpdate || canDelete}
          toast={toast}
        />
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        size="sm"
        title="Supprimer le fournisseur"
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setDeleteTarget(null)} disabled={deleting}>Annuler</button>
            <button type="button" className={btnDanger} onClick={confirmDelete} disabled={deleting}>{deleting ? 'Suppression…' : 'Supprimer'}</button>
          </div>
        )}
      >
        <p className="text-sm text-neutral-600">
          Supprimer <strong>{deleteTarget?.name_fr}</strong> ? Le fournisseur est archivé (suppression logique) et n'est plus sélectionnable.
          La suppression est refusée s'il a des bons de commande en cours.
        </p>
      </Modal>
    </div>
  );
}

// ─── Fiche fournisseur ──────────────────────────────────────────────────────

function SupplierSheet({
  supplierId, creating, canCreate, canUpdate, canDelete, canViewPo, canCreatePo, toast, onSaved, onDelete, onCancel, onPrices, onCreate,
}) {
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(!!supplierId);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const load = useCallback(async () => {
    if (!supplierId) return;
    setLoading(true);
    try {
      const { data } = await getSupplier(supplierId);
      setSupplier(data.data);
      setForm(toForm(data.data));
    } catch (err) {
      toast('error', errMsg(err, 'Fournisseur introuvable'));
      setSupplier(null);
    } finally {
      setLoading(false);
    }
  }, [supplierId, toast]);

  useEffect(() => { load(); }, [load]);

  const readOnly = creating ? !canCreate : (!canUpdate || supplier?.status === 'deleted');
  const setF = (k) => (e) => {
    const v = e?.target?.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const dirty = useMemo(() => (supplier ? JSON.stringify(toForm(supplier)) !== JSON.stringify(form) : true), [supplier, form]);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.code.trim()) errs.code = 'Code requis';
    if (!form.name_fr.trim()) errs.name_fr = 'Nom français requis';
    if (!form.name_ar.trim()) errs.name_ar = 'Nom arabe requis';
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) errs.contact_email = 'E-mail invalide';
    if (form.score !== '' && (Number(form.score) < 0 || Number(form.score) > 99.9)) errs.score = 'Score entre 0 et 99,9';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = {
      ...form,
      lead_time_days: form.lead_time_days === '' ? null : Number(form.lead_time_days),
      score: form.score === '' ? null : Number(form.score),
    };
    setSaving(true);
    try {
      if (creating) {
        const { data } = await createSupplier(payload);
        toast('success', 'Fournisseur créé');
        onSaved(data.data, true);
      } else {
        const { data } = await updateSupplier(supplierId, payload);
        setSupplier(data.data);
        setForm(toForm(data.data));
        toast('success', 'Fournisseur mis à jour');
        onSaved(data.data, false);
      }
    } catch (err) {
      const msg = errMsg(err, "Erreur lors de l'enregistrement");
      toast('error', msg);
      if (err?.response?.status === 409 && /code/i.test(msg)) setErrors((x) => ({ ...x, code: msg }));
    } finally {
      setSaving(false);
    }
  };

  if (!supplierId && !creating) {
    return (
      <EmptyState icon={Truck} title="Aucun fournisseur sélectionné">
        <p>Choisissez un fournisseur dans la « Liste fournisseurs »{canCreate ? ' ou créez-en un nouveau' : ''}.</p>
        {canCreate && <button type="button" className={`${btnPrimary} mt-3`} onClick={onCreate}><Plus size={16} /> Nouveau fournisseur</button>}
      </EmptyState>
    );
  }
  if (loading) return <Spinner className="py-24" />;
  if (!creating && !supplier) return <EmptyState icon={Truck} title="Fournisseur introuvable" />;

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card
          title={creating ? 'Nouveau fournisseur' : `${supplier.name_fr}`}
          actions={!creating && <SupplierStatus s={supplier} />}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Code" required error={errors.code} hint="Unique, ex. FRN-CENTRALE">
              <input value={form.code} onChange={setF('code')} disabled={readOnly} className={`${inputCls} font-mono uppercase`} maxLength={50} />
            </Field>
            <Field label="Nom (FR)" required error={errors.name_fr} className="md:col-span-2">
              <input value={form.name_fr} onChange={setF('name_fr')} disabled={readOnly} className={inputCls} maxLength={200} />
            </Field>
            <Field label="الاسم (AR)" required error={errors.name_ar} className="md:col-span-3">
              <input value={form.name_ar} onChange={setF('name_ar')} disabled={readOnly} className={`${inputCls} text-right`} dir="rtl" maxLength={200} />
            </Field>
          </div>
        </Card>

        <Card title="Contact">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Nom du contact">
              <input value={form.contact_name} onChange={setF('contact_name')} disabled={readOnly} className={inputCls} maxLength={150} />
            </Field>
            <Field label="Téléphone">
              <input value={form.contact_phone} onChange={setF('contact_phone')} disabled={readOnly} className={inputCls} maxLength={30} />
            </Field>
            <Field label="E-mail" error={errors.contact_email}>
              <input type="email" value={form.contact_email} onChange={setF('contact_email')} disabled={readOnly} className={inputCls} maxLength={150} />
            </Field>
            <Field label="Adresse" className="md:col-span-3">
              <textarea value={form.address} onChange={setF('address')} disabled={readOnly} rows={2} className={inputCls} />
            </Field>
          </div>
        </Card>

        <Card title="Conditions">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Conditions de paiement" hint="Ex. Net 30, paiement à la livraison">
              <input value={form.payment_terms} onChange={setF('payment_terms')} disabled={readOnly} className={inputCls} maxLength={150} />
            </Field>
            <Field label="Délai de livraison (jours)" hint="Sert à proposer la date de livraison des BC">
              <input type="number" min="0" max="365" step="1" value={form.lead_time_days} onChange={setF('lead_time_days')} disabled={readOnly} className={inputCls} />
            </Field>
            <Field label="Score de performance" error={errors.score} hint="0 à 99,9">
              <input type="number" min="0" max="99.9" step="0.1" value={form.score} onChange={setF('score')} disabled={readOnly} className={inputCls} />
            </Field>
            <Field label="Notes" className="md:col-span-3">
              <textarea value={form.notes} onChange={setF('notes')} disabled={readOnly} rows={3} className={inputCls} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-neutral-700 md:col-span-3">
              <input type="checkbox" checked={form.is_active} onChange={setF('is_active')} disabled={readOnly} className="h-4 w-4 rounded border-neutral-300 accent-[#E10600]" />
              Fournisseur actif (sélectionnable dans les bons de commande)
            </label>
          </div>
        </Card>

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={creating ? onCancel : () => setForm(toForm(supplier))} disabled={saving}>
            Annuler
          </button>
          {!creating && canDelete && supplier.status !== 'deleted' && (
            <button type="button" className={btnDanger} onClick={() => onDelete(supplier)} disabled={saving}><Trash2 size={16} /> Supprimer</button>
          )}
          {!readOnly && (
            <button type="submit" className={btnPrimary} disabled={saving || (!creating && !dirty)}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer
            </button>
          )}
        </div>
      </div>

      {!creating && (
        <div className="space-y-4">
          <Card title="Activité">
            <InfoRow label="BC en cours" value={<span className={supplier.open_po_count ? 'text-amber-600' : ''}>{supplier.open_po_count ?? 0}</span>} />
            <InfoRow label="BC (hors annulés)" value={supplier.po_count ?? 0} />
            <InfoRow label="Total HT commandé" value={fmtMoney(supplier.po_total_ht)} />
            <InfoRow label="Dernier BC" value={supplier.last_po ? `${supplier.last_po.reference} · ${fmtDate(supplier.last_po.created_at)}` : '—'} />
            <InfoRow label="Prix actifs (SKU)" value={supplier.prices_count ?? 0} />
            <InfoRow label="Créé le" value={fmtDate(supplier.created_at)} />
          </Card>
          <Card title="Navigation">
            <div className="flex flex-col gap-2">
              <button type="button" className={btnSecondary} onClick={() => onPrices(supplier)}><Tag size={16} /> Prix fournisseurs (SKU)</button>
              {canViewPo && (
                <button type="button" className={btnSecondary} onClick={() => navigate(`/purchasing/purchase-orders?supplier_id=${supplier.id}`)}>
                  <ClipboardList size={16} /> Bons de commande du fournisseur
                </button>
              )}
              {canCreatePo && supplier.status === 'active' && (
                <button type="button" className={btnSecondary} onClick={() => navigate(`/purchasing/purchase-orders?tab=new&supplier_id=${supplier.id}`)}>
                  <FilePlus2 size={16} /> Nouveau BC pour ce fournisseur
                </button>
              )}
            </div>
            {supplier.open_po_count > 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Désactivation et suppression bloquées tant que {supplier.open_po_count} BC sont en cours.
              </p>
            )}
          </Card>
        </div>
      )}
    </form>
  );
}
