import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, Plus, Power, PowerOff, Search, Trash2, Pencil, ListChecks, Download, Loader2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  getCoupons, getCouponLookups, setCouponActive, getCouponDeletionCheck, deleteCoupon,
} from '../../../api/coupons.api';
import CouponConfigModal from './CouponConfigModal';
import CouponUsagesTab from './CouponUsagesTab';
import {
  apiError, DeleteGuardModal, exportCsv, formatDate, money, primaryBtn, Tabs,
} from './offresUi';

const TABS = [
  { key: 'list', label: 'Liste des codes & Configuration' },
  { key: 'usages', label: 'Utilisations (suivi)' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'active', label: 'Actif' },
  { value: 'scheduled', label: 'Programmé' },
  { value: 'exhausted', label: 'Épuisé' },
  { value: 'expired', label: 'Expiré' },
  { value: 'inactive', label: 'Inactif' },
  { value: 'deleted', label: 'Supprimé' },
];

const ORIGIN_OPTIONS = [
  { value: '', label: 'Toutes les origines' },
  { value: 'manual', label: 'Manuel' },
  { value: 'gamification', label: 'Gamification' },
  { value: 'referral', label: 'Parrainage' },
];

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700',
  scheduled: 'bg-sky-50 text-sky-700',
  exhausted: 'bg-amber-50 text-amber-700',
  expired: 'bg-amber-50 text-amber-700',
  inactive: 'bg-neutral-100 text-neutral-500',
  deleted: 'bg-red-50 text-red-600',
};

const ORIGIN_STYLES = {
  manual: 'bg-neutral-100 text-neutral-600',
  gamification: 'bg-violet-50 text-violet-700',
  referral: 'bg-sky-50 text-sky-700',
};

const PAGE_SIZE = 20;

export function couponValueLabel(c) {
  if (c.type === 'PERCENTAGE') return `${c.value} %${c.max_discount != null ? ` (max ${money(c.max_discount)})` : ''}`;
  if (c.type === 'FREE_SHIPPING') return 'Livraison offerte';
  return money(c.value);
}

export default function CouponsPage() {
  const { hasPermission } = useAuth();
  const canView = ['coupons.view', 'coupons.manage', 'dashboard.view'].some((p) => hasPermission(p));
  const canManage = ['coupons.manage', 'dashboard.view'].some((p) => hasPermission(p));
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'usages' ? 'usages' : 'list');
  const [lookups, setLookups] = useState({ nodes: [], promo_types: [], order_statuses: [] });
  const [filters, setFilters] = useState({ search: '', node_id: '', status: '', type: '', origin: '' });
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [configOpen, setConfigOpen] = useState(false);
  const [configId, setConfigId] = useState(null);
  const [usagePrefilter, setUsagePrefilter] = useState(null);
  const [del, setDel] = useState(null); // { coupon, loading, check, busy, error }

  useEffect(() => {
    if (!canView) return;
    getCouponLookups().then(({ data }) => setLookups(data.data)).catch(() => {});
  }, [canView]);

  // Ouverture directe : /offres/codes-promo?id=<uuid>
  useEffect(() => {
    const id = searchParams.get('id');
    if (id) { setConfigId(id); setConfigOpen(true); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const queryParams = useCallback(() => {
    const p = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v; });
    return p;
  }, [filters]);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true); setError(null);
    try {
      const { data } = await getCoupons({ ...queryParams(), page, limit: PAGE_SIZE });
      setItems(data.data ?? []);
      setPagination(data.pagination ?? data.meta ?? { total: 0, pages: 0 });
    } catch (err) {
      setError(apiError(err, 'Erreur de chargement'));
    } finally { setLoading(false); }
  }, [canView, queryParams, page]);

  useEffect(() => {
    const t = setTimeout(load, filters.search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1); }, [filters]);

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  function openConfig(id = null) {
    setConfigId(id);
    setConfigOpen(true);
  }

  function closeConfig() {
    setConfigOpen(false);
    if (searchParams.get('id')) { searchParams.delete('id'); setSearchParams(searchParams, { replace: true }); }
  }

  function showUsages(coupon) {
    setUsagePrefilter({ promotion_id: coupon.id, code: coupon.code });
    setConfigOpen(false);
    setActiveTab('usages');
  }

  async function toggle(coupon) {
    setBusyId(coupon.id);
    try {
      await setCouponActive(coupon.id, !coupon.is_active);
      await load();
    } catch (err) {
      alert(apiError(err));
    } finally { setBusyId(null); }
  }

  async function askDelete(coupon) {
    setDel({ coupon, loading: true, check: null, busy: false, error: null });
    try {
      const { data } = await getCouponDeletionCheck(coupon.id, true);
      setDel((d) => d && { ...d, loading: false, check: data.data });
    } catch (err) {
      setDel((d) => d && { ...d, loading: false, error: apiError(err) });
    }
  }

  async function confirmDelete() {
    if (!del?.coupon) return;
    setDel((d) => ({ ...d, busy: true, error: null }));
    try {
      await deleteCoupon(del.coupon.id);
      setDel(null);
      setConfigOpen(false);
      await load();
    } catch (err) {
      const details = err?.response?.data?.details;
      setDel((d) => ({ ...d, busy: false, check: details ?? d.check, error: details ? null : apiError(err) }));
    }
  }

  async function deactivateInstead() {
    if (!del?.coupon) return;
    setDel((d) => ({ ...d, busy: true }));
    try {
      await setCouponActive(del.coupon.id, false);
      setDel(null);
      setConfigOpen(false);
      await load();
    } catch (err) {
      setDel((d) => ({ ...d, busy: false, error: apiError(err) }));
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const { data } = await getCoupons({ ...queryParams(), page: 1, limit: 500 });
      exportCsv(
        `codes-promo-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Code', 'Type', 'Valeur', 'Scope', 'Node', 'Min. commande (MAD)', 'Cumulable', 'Début', 'Fin', 'Utilisations', 'Max total', 'Max par client', 'Statut', 'Origine', 'Client affecté'],
        (data.data ?? []).map((c) => [
          c.code, c.type_name ?? c.type, couponValueLabel(c), c.node_id ? 'Node' : 'Global', c.node_name ?? 'Tous',
          c.min_order_amount, c.is_combined ? 'Oui' : 'Non', formatDate(c.valid_from), formatDate(c.valid_to),
          c.uses_count, c.uses_max ?? 'Illimité', c.uses_per_user_max, c.status_label, c.origin_label,
          c.customer_name ? `${c.customer_name} ${c.customer_phone ?? ''}` : 'Public',
        ]),
      );
    } catch (err) {
      alert(apiError(err, 'Export impossible'));
    } finally { setExporting(false); }
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
          <h1 className="page-title">Codes Promo</h1>
          <p className="page-subtitle">Créer et suivre les codes promotionnels (node_id vide = code global).</p>
        </div>
        {activeTab === 'list' && canManage && (
          <button type="button" className={primaryBtn} onClick={() => openConfig(null)}>
            <Plus size={18} /> Créer code promo
          </button>
        )}
      </div>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'usages' ? (
        <CouponUsagesTab lookups={lookups} prefilter={usagePrefilter} onClearPrefilter={() => setUsagePrefilter(null)} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input className="form-input pl-9" placeholder="Code, client…" value={filters.search} onChange={(e) => setF('search', e.target.value)} />
            </div>
            <select className="form-select" value={filters.node_id} onChange={(e) => setF('node_id', e.target.value)}>
              <option value="">Tous les nodes</option>
              <option value="global">Global (tous les nodes)</option>
              {lookups.nodes.map((n) => <option key={n.id} value={n.id}>{n.name_fr}</option>)}
            </select>
            <select className="form-select" value={filters.status} onChange={(e) => setF('status', e.target.value)}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className="form-select" value={filters.type} onChange={(e) => setF('type', e.target.value)}>
              <option value="">Tous les types de remise</option>
              {lookups.promo_types.map((t) => <option key={t.id} value={t.code}>{t.name_fr}</option>)}
            </select>
            <select className="form-select" value={filters.origin} onChange={(e) => setF('origin', e.target.value)}>
              {ORIGIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="flex items-center justify-between text-sm text-neutral-500">
            <span>{pagination.total ?? 0} code(s)</span>
            <button type="button" className="btn-secondary" disabled={exporting || !pagination.total} onClick={handleExport}>
              {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Exporter
            </button>
          </div>

          <div className="table-wrap overflow-x-auto">
            <table className="w-full min-w-[1150px]">
              <thead>
                <tr>
                  <th className="table-th">Code</th>
                  <th className="table-th">Type</th>
                  <th className="table-th">Valeur</th>
                  <th className="table-th">Scope</th>
                  <th className="table-th text-right">Min. commande</th>
                  <th className="table-th">Validité</th>
                  <th className="table-th">Node</th>
                  <th className="table-th text-center">Utilisations</th>
                  <th className="table-th">Statut</th>
                  <th className="table-th">Origine</th>
                  <th className="table-th">Client affecté</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={12} className="table-td py-10 text-center text-neutral-400">Chargement…</td></tr>
                ) : error ? (
                  <tr><td colSpan={12} className="table-td py-10 text-center text-red-600">{error}</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={12} className="table-td py-10 text-center text-neutral-400">Aucun code promo ne correspond à ces filtres.</td></tr>
                ) : items.map((c) => (
                  <tr key={c.id} className={`cursor-pointer hover:bg-neutral-50 ${c.is_deleted ? 'opacity-60' : ''}`} onClick={() => openConfig(c.id)}>
                    <td className="table-td font-mono font-semibold text-neutral-900">{c.code}{c.is_combined && <span className="ml-1 rounded bg-neutral-100 px-1 text-[10px] font-sans text-neutral-500" title="Cumulable avec d'autres offres">cumul</span>}</td>
                    <td className="table-td text-xs">{c.type_name ?? c.type}</td>
                    <td className="table-td font-medium text-red-600">{couponValueLabel(c)}</td>
                    <td className="table-td text-xs">
                      {c.node_id ? 'Node' : 'Global'}
                      <span className="block text-neutral-400">{c.customer_id ? 'Nominatif' : 'Public'}</span>
                    </td>
                    <td className="table-td text-right">{money(c.min_order_amount)}</td>
                    <td className="table-td whitespace-nowrap text-xs">{formatDate(c.valid_from, false)} → {formatDate(c.valid_to, false)}</td>
                    <td className="table-td text-xs">{c.node_name ?? 'Tous'}</td>
                    <td className="table-td text-center text-xs">{c.uses_count}{c.uses_max != null ? ` / ${c.uses_max}` : ' / ∞'}<span className="block text-neutral-400">max {c.uses_per_user_max}/client</span></td>
                    <td className="table-td"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[c.status] ?? ''}`}>{c.status_label}</span></td>
                    <td className="table-td"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${ORIGIN_STYLES[c.origin] ?? ''}`}>{c.origin_label}</span></td>
                    <td className="table-td text-xs">{c.customer_name ? <>{c.customer_name}<span className="block text-neutral-400">{c.customer_phone}</span></> : <span className="text-neutral-400">—</span>}</td>
                    <td className="table-td" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" title="Configuration" onClick={() => openConfig(c.id)}><Pencil size={15} /></button>
                        <button type="button" className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" title="Utilisations" onClick={() => showUsages(c)}><ListChecks size={15} /></button>
                        {canManage && !c.is_deleted && (
                          <>
                            <button type="button" disabled={busyId === c.id} onClick={() => toggle(c)}
                              className={`rounded-lg p-2 transition disabled:opacity-50 ${c.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-neutral-400 hover:bg-neutral-100'}`}
                              title={c.is_active ? 'Désactiver' : 'Activer'}>
                              {c.is_active ? <Power size={15} /> : <PowerOff size={15} />}
                            </button>
                            <button type="button" className="rounded-lg p-2 text-neutral-500 hover:bg-red-50 hover:text-red-600" title="Supprimer" onClick={() => askDelete(c)}><Trash2 size={15} /></button>
                          </>
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

      <CouponConfigModal
        open={configOpen}
        couponId={configId}
        lookups={lookups}
        canManage={canManage}
        onClose={closeConfig}
        onSaved={(c) => { if (!configId && c?.id) setConfigId(c.id); load(); }}
        onDelete={(c) => askDelete(c)}
        onShowUsages={showUsages}
      />

      <DeleteGuardModal
        open={!!del}
        onClose={() => setDel(null)}
        title="Supprimer le code promo"
        label={del?.coupon?.code}
        loading={del?.loading}
        check={del?.check}
        busy={del?.busy}
        error={del?.error}
        onConfirm={confirmDelete}
        onDeactivate={del?.coupon?.is_active ? deactivateInstead : null}
      />
    </div>
  );
}
