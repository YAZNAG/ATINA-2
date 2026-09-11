import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ImageOff, Lock, Pencil, Plus, Power, PowerOff, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  getFlashSales, getFlashLookups, setFlashSaleActive, getFlashSaleDeletionCheck, deleteFlashSale,
} from '../../../api/offres.api';
import {
  apiError, DeleteGuardModal, formatDate, money, primaryBtn, Tabs,
} from '../coupons/offresUi';
import FlashSaleConfig from './FlashSaleConfig';
import { FLASH_STATUS_OPTIONS, FlashStatusBadge } from './flashStatus';

const TABS = [
  { key: 'list', label: 'Liste des flash sales' },
  { key: 'config', label: 'Configuration flash sale' },
];

const PAGE_SIZE = 20;

/**
 * Offres > Flash Sales — ventes flash à durée limitée, SKU ou pack × période, rattachées à un node.
 * WF #1 (créer), #18 (modifier), #33 (annuler / supprimer) ; US-074, US-075, US-111.
 */
export default function FlashSalesPage() {
  const { hasPermission } = useAuth();
  const canView = ['flash_sales.view', 'flash_sales.manage', 'promotions.view', 'dashboard.view'].some((p) => hasPermission(p));
  const canManage = ['flash_sales.manage', 'dashboard.view'].some((p) => hasPermission(p));
  const [searchParams, setSearchParams] = useSearchParams();

  const initialId = searchParams.get('id');
  const [activeTab, setActiveTab] = useState(initialId ? 'config' : 'list');
  const [selectedId, setSelectedId] = useState(initialId || null);
  const [nodes, setNodes] = useState([]);
  const [filters, setFilters] = useState({ search: '', node_id: '', flash_status: '', target: '', date_from: '', date_to: '' });
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [del, setDel] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [configNotice, setConfigNotice] = useState(null);

  useEffect(() => {
    if (!canView) return;
    getFlashLookups().then(({ data }) => setNodes(data.data.nodes ?? [])).catch(() => {});
  }, [canView]);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true); setError(null);
    try {
      const params = { page, limit: PAGE_SIZE };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      if (filters.target) { params.scope_type = filters.target; delete params.target; }
      const { data } = await getFlashSales(params);
      setItems(data.data ?? []);
      setPagination(data.pagination ?? data.meta ?? { total: 0, pages: 0 });
    } catch (err) {
      setError(apiError(err, 'Erreur de chargement'));
    } finally { setLoading(false); }
  }, [canView, filters, page]);

  useEffect(() => {
    if (activeTab !== 'list') return undefined;
    const t = setTimeout(load, filters.search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1); }, [filters]);

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  function openConfig(id = null, notice = null) {
    setConfigNotice(notice);
    setSelectedId(id);
    setActiveTab('config');
    if (id) setSearchParams({ id }, { replace: true });
    else if (searchParams.get('id')) setSearchParams({}, { replace: true });
  }

  function backToList() {
    setActiveTab('list');
    if (searchParams.get('id')) setSearchParams({}, { replace: true });
  }

  async function toggle(fs) {
    setBusyId(fs.id);
    try {
      await setFlashSaleActive(fs.id, !fs.is_active);
      await load();
    } catch (err) {
      alert(apiError(err));
    } finally { setBusyId(null); }
  }

  async function askDelete(fs) {
    setDel({ fs, loading: true, check: null, busy: false, error: null });
    try {
      const { data } = await getFlashSaleDeletionCheck(fs.id, true);
      setDel((d) => d && { ...d, loading: false, check: data.data });
    } catch (err) {
      setDel((d) => d && { ...d, loading: false, error: apiError(err) });
    }
  }

  async function confirmDelete() {
    if (!del?.fs) return;
    setDel((d) => ({ ...d, busy: true, error: null }));
    try {
      await deleteFlashSale(del.fs.id);
      setDel(null);
      backToList();
      await load();
    } catch (err) {
      const details = err?.response?.data?.details;
      setDel((d) => ({ ...d, busy: false, check: details ?? d.check, error: details ? null : apiError(err) }));
    }
  }

  async function deactivateInstead() {
    if (!del?.fs) return;
    setDel((d) => ({ ...d, busy: true }));
    try {
      await setFlashSaleActive(del.fs.id, false);
      setDel(null);
      setReloadKey((k) => k + 1); // recharge l'onglet Configuration s'il est ouvert
      await load();
    } catch (err) {
      setDel((d) => ({ ...d, busy: false, error: apiError(err) }));
    }
  }

  if (!canView) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-neutral-400">
        <Lock size={28} />
        <p className="text-sm">Vous n'avez pas accès à cette page.</p>
      </div>
    );
  }

  return (
    <div className="page-shell p-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Flash Sales</h1>
          <p className="page-subtitle">Ventes flash à durée limitée : un produit ou un pack, sur un node, pendant une plage horaire.</p>
        </div>
        {canManage && (
          <button type="button" className={primaryBtn} onClick={() => openConfig(null)}>
            <Plus size={18} /> Nouvelle flash sale
          </button>
        )}
      </div>

      <Tabs tabs={TABS} active={activeTab} onChange={(k) => (k === 'config' ? openConfig(selectedId) : backToList())} />

      {activeTab === 'config' ? (
        <FlashSaleConfig
          key={`${selectedId ?? 'new'}-${reloadKey}`}
          id={selectedId}
          nodes={nodes}
          canManage={canManage}
          onBack={backToList}
          onDelete={askDelete}
          initialSuccess={configNotice}
          onSaved={(saved, created) => {
            if (created && saved?.id) {
              openConfig(saved.id, "Vente flash enregistrée (inactive). Cliquez sur « Activer » pour la lancer : elle sera visible dans l'app à partir de sa date de début.");
            }
          }}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <div className="relative lg:col-span-2">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input className="form-input pl-9" placeholder="Rechercher (nom, SKU, pack)…" value={filters.search} onChange={(e) => setF('search', e.target.value)} />
            </div>
            <select className="form-select" value={filters.node_id} onChange={(e) => setF('node_id', e.target.value)}>
              <option value="">Tous les nodes</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.name_fr}</option>)}
            </select>
            <select className="form-select" value={filters.flash_status} onChange={(e) => setF('flash_status', e.target.value)}>
              {FLASH_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input type="date" className="form-input" title="Période — du" value={filters.date_from} onChange={(e) => setF('date_from', e.target.value)} />
            <input type="date" className="form-input" title="Période — au" value={filters.date_to} onChange={(e) => setF('date_to', e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500">
            <div className="flex overflow-hidden rounded-lg border border-neutral-200 bg-white">
              {[{ v: '', l: 'Toutes cibles' }, { v: 'sku', l: 'Produits' }, { v: 'pack', l: 'Packs' }].map((o) => (
                <button key={o.v} type="button" onClick={() => setF('target', o.v)}
                  className={`px-3 py-1.5 text-xs font-medium ${filters.target === o.v ? 'bg-red-600 text-white' : 'text-neutral-600 hover:bg-neutral-50'}`}>{o.l}</button>
              ))}
            </div>
            <span>{pagination.total ?? 0} vente(s) flash</span>
          </div>

          <div className="table-wrap overflow-x-auto">
            <table className="w-full min-w-[1050px]">
              <thead>
                <tr>
                  <th className="table-th">Image</th>
                  <th className="table-th">SKU / pack</th>
                  <th className="table-th">Node</th>
                  <th className="table-th">Prix flash</th>
                  <th className="table-th text-center">Plafond (vendu / quota)</th>
                  <th className="table-th">Période</th>
                  <th className="table-th">Statut</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={8} className="table-td py-10 text-center text-neutral-400">Chargement…</td></tr>
                ) : error ? (
                  <tr><td colSpan={8} className="table-td py-10 text-center text-red-600">{error}</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={8} className="table-td py-10 text-center text-neutral-400">Aucune vente flash ne correspond à ces filtres.</td></tr>
                ) : items.map((fs) => (
                  <tr key={fs.id} className={`cursor-pointer hover:bg-neutral-50 ${fs.is_deleted ? 'opacity-60' : ''}`} onClick={() => openConfig(fs.id)}>
                    <td className="table-td">
                      {fs.image_url
                        ? <img src={fs.image_url} alt="" className="h-10 w-10 rounded-md object-cover" />
                        : <div className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-100 text-neutral-300"><ImageOff size={16} /></div>}
                    </td>
                    <td className="table-td">
                      <p className="font-medium text-neutral-800">{fs.name_fr || fs.scope_name || '—'}</p>
                      <p className="text-xs text-neutral-400">
                        <span className="mr-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase text-neutral-500">{fs.target === 'pack' ? 'Pack' : 'Produit'}</span>
                        {fs.target === 'pack' ? fs.pack_name : `${fs.scope_name ?? ''} ${fs.sku_code ? `· ${fs.sku_code}` : ''}`}
                      </p>
                    </td>
                    <td className="table-td text-xs">{fs.node_name ?? '—'}</td>
                    <td className="table-td whitespace-nowrap">
                      {fs.reference_price != null && <span className="mr-1 text-xs text-neutral-400 line-through">{money(fs.reference_price)}</span>}
                      <span className="font-medium text-red-600">{money(fs.flash_price)}</span>
                      {fs.discount_pct != null && <span className="block text-xs text-neutral-500">-{fs.discount_pct} % · max {fs.max_qty_per_user}/client</span>}
                    </td>
                    <td className="table-td text-center text-sm">
                      {fs.sold_count} / {fs.stock_flash ?? '—'}
                      <span className="block text-xs text-neutral-400">reste {fs.remaining_quota ?? '—'}</span>
                    </td>
                    <td className="table-td whitespace-nowrap text-xs text-neutral-600">{formatDate(fs.starts_at)}<span className="block">→ {formatDate(fs.ends_at)}</span></td>
                    <td className="table-td"><FlashStatusBadge item={fs} /></td>
                    <td className="table-td" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" title="Configuration" onClick={() => openConfig(fs.id)}><Pencil size={15} /></button>
                        {canManage && !fs.is_deleted && (fs.is_active || !fs.is_expired) && (
                          <button type="button" disabled={busyId === fs.id} onClick={() => toggle(fs)}
                            className={`rounded-lg p-2 transition disabled:opacity-50 ${fs.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-neutral-400 hover:bg-neutral-100'}`}
                            title={fs.is_active ? 'Désactiver' : 'Activer'}>
                            {fs.is_active ? <Power size={15} /> : <PowerOff size={15} />}
                          </button>
                        )}
                        {canManage && !fs.is_deleted && (
                          <button type="button" className="rounded-lg p-2 text-neutral-500 hover:bg-red-50 hover:text-red-600" title="Supprimer" onClick={() => askDelete(fs)}><Trash2 size={15} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</button>
              <span className="text-neutral-500">Page {page} / {pagination.pages}</span>
              <button type="button" className="btn-secondary" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Suivant</button>
            </div>
          )}
        </div>
      )}

      <DeleteGuardModal
        open={!!del}
        onClose={() => setDel(null)}
        title="Annuler (supprimer) la vente flash"
        label={del?.fs?.name_fr ?? del?.fs?.scope_name}
        loading={del?.loading}
        check={del?.check}
        busy={del?.busy}
        error={del?.error}
        onConfirm={confirmDelete}
        onDeactivate={del?.fs?.is_active ? deactivateInstead : null}
      />
    </div>
  );
}
