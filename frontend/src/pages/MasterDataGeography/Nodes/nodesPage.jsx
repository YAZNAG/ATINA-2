import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, Loader2, Lock, Power, PowerOff, MapPin, Eye } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { getNodes, updateNode, deleteNode, getRegions, getActiveNodeTypes } from '../../../api/locationNode.api';
import { useCascadeGeo } from './useCascadeGeo';
import NodeDrawer from './NodeDrawer';

const PAGE_LIMIT = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
  { value: 'deleted', label: 'Supprimé' },
];

const buildStatusParams = (value) => {
  if (value === 'active') return { is_active: true };
  if (value === 'inactive') return { is_active: false };
  if (value === 'deleted') return { is_deleted: true };
  return {};
};

function StatusBadge({ item }) {
  if (item.is_deleted) {
    return <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">Supprimé</span>;
  }
  if (item.is_active) {
    return <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Actif</span>;
  }
  return <span className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">Inactif</span>;
}

export default function NodesPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canView = hasPermission('nodes.view');
  const canCreate = hasPermission('nodes.create');
  const canUpdate = hasPermission('nodes.update');
  const canDelete = hasPermission('nodes.delete');

  const [nodeTypes, setNodeTypes] = useState([]);
  const [allRegions, setAllRegions] = useState([]);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [filterNodeType, setFilterNodeType] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterProvince, setFilterProvince] = useState('');
  const [filterCity, setFilterCity] = useState('');

  const { provinces: filterProvinces, cities: filterCities } = useCascadeGeo({
    regionId: filterRegion,
    provinceId: filterProvince,
    onProvinceReset: () => { setFilterProvince(''); setFilterCity(''); },
    onCityReset: () => setFilterCity(''),
  });

  const [drawer, setDrawer] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const [toast, setToast] = useState(null);
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!canView) return;
    (async () => {
      try {
        const [typesRes, regionsRes] = await Promise.all([
          getActiveNodeTypes(),
          getRegions({ limit: 500, is_active: true }),
        ]);
        setNodeTypes(typesRes.data.data || typesRes.data || []);
        setAllRegions(regionsRes.data.data || regionsRes.data || []);
      } catch (err) {
        console.error('Erreur chargement filtres:', err?.response?.data || err);
      }
    })();
  }, [canView]);

  const fetchNodes = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const { data } = await getNodes({
        page,
        limit: PAGE_LIMIT,
        ...(search && { search }),
        ...buildStatusParams(status),
        ...(filterNodeType && { node_type_id: filterNodeType }),
        ...(filterRegion && { region_id: filterRegion }),
        ...(filterProvince && { province_id: filterProvince }),
        ...(filterCity && { city_id: filterCity }),
      });
      setRows(data.data || []);
      setTotal(data.pagination?.total ?? (data.data || []).length);
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du chargement des nodes');
    } finally {
      setLoading(false);
    }
  }, [canView, page, search, status, filterNodeType, filterRegion, filterProvince, filterCity]);

  useEffect(() => {
    const t = setTimeout(fetchNodes, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [fetchNodes]);

  useEffect(() => { setPage(1); }, [search, status, filterNodeType, filterRegion, filterProvince, filterCity]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const toggleActive = async (item) => {
    setTogglingId(item.id);
    try {
      await updateNode(item.id, { is_active: !item.is_active });
      showToast('success', !item.is_active ? 'Node activé' : 'Node désactivé');
      fetchNodes();
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du changement de statut');
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteNode(deleteTarget.id);
      showToast('success', 'Node supprimé');
      setDeleteTarget(null);
      fetchNodes();
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  if (!canView) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-neutral-400">
        <Lock size={28} />
        <p className="text-sm">Vous n'avez pas accès à cette page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-[#E10600]'}`}>
          {toast.message}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Noeuds</h1>
          <p className="mt-1 text-sm text-neutral-500">Entrepôts, dark stores et points relais du réseau logistique.</p>
        </div>
        {canCreate && (
          <button onClick={() => setDrawer({ editNode: null })}
            className="flex items-center gap-1.5 rounded-lg bg-[#E10600] px-3.5 py-2 text-sm font-medium text-white transition hover:bg-[#c00500] active:scale-[0.98]">
            <Plus size={16} />
            Nouveau node
          </button>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-neutral-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher (code, nom)…"
            className="w-full rounded-md border border-neutral-200 bg-neutral-50 py-2 pl-8 pr-3 text-sm outline-none transition focus:border-[#E10600] focus:bg-white focus:ring-2 focus:ring-[#E10600]/15" />
        </div>

        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-sm outline-none transition focus:border-[#E10600] focus:bg-white focus:ring-2 focus:ring-[#E10600]/15">
          {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>

        <select value={filterNodeType} onChange={(e) => setFilterNodeType(e.target.value)}
          className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-sm outline-none transition focus:border-[#E10600] focus:bg-white focus:ring-2 focus:ring-[#E10600]/15">
          <option value="">Tous les types</option>
          {nodeTypes.map((t) => <option key={t.id} value={t.id}>{t.name_fr}</option>)}
        </select>

        <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)}
          className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-sm outline-none transition focus:border-[#E10600] focus:bg-white focus:ring-2 focus:ring-[#E10600]/15">
          <option value="">Toutes les régions</option>
          {allRegions.map((r) => <option key={r.id} value={r.id}>{r.name_fr}</option>)}
        </select>

        <select value={filterProvince} onChange={(e) => setFilterProvince(e.target.value)} disabled={!filterRegion}
          className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-sm outline-none transition focus:border-[#E10600] focus:bg-white focus:ring-2 focus:ring-[#E10600]/15 disabled:cursor-not-allowed disabled:opacity-50">
          <option value="">Toutes les provinces</option>
          {filterProvinces.map((p) => <option key={p.id} value={p.id}>{p.name_fr}</option>)}
        </select>

        <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)} disabled={!filterProvince}
          className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-sm outline-none transition focus:border-[#E10600] focus:bg-white focus:ring-2 focus:ring-[#E10600]/15 disabled:cursor-not-allowed disabled:opacity-50">
          <option value="">Toutes les villes</option>
          {filterCities.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-neutral-100 bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500">Localisation</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center text-neutral-400"><Loader2 size={20} className="mx-auto animate-spin" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-sm text-neutral-400">Aucun node trouvé.</td></tr>
              ) : (
                rows.map((item) => {
                  const isDeleted = Boolean(item.is_deleted);
                  return (
                    <tr key={item.id} className={`transition hover:bg-neutral-50 ${isDeleted ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-mono text-sm text-neutral-700">{item.code}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-neutral-800">{item.name_fr}</div>
                        <div className="text-xs text-neutral-400" dir="rtl">{item.name_ar}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">{item.node_type?.name_fr || '—'}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={13} className="shrink-0 text-neutral-400" />
                          <span className="truncate">
                            {[item.city?.name_fr, item.province?.name_fr, item.region?.name_fr].filter(Boolean).join(', ') || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge item={item} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <button onClick={() => navigate(`/nodes/${item.id}`)} title="Voir le détail"
                            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800">
                            <Eye size={14} />
                          </button>
                          {!isDeleted && canUpdate && (
                            <button onClick={() => toggleActive(item)} disabled={togglingId === item.id}
                              title={item.is_active ? 'Désactiver' : 'Activer'}
                              className={`rounded-md p-1.5 transition disabled:opacity-50 ${item.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-neutral-400 hover:bg-neutral-100'}`}>
                              {togglingId === item.id ? <Loader2 size={14} className="animate-spin" /> : item.is_active ? <Power size={14} /> : <PowerOff size={14} />}
                            </button>
                          )}
                          {!isDeleted && canUpdate && (
                            <button onClick={() => setDrawer({ editNode: item })} title="Modifier"
                              className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800">
                              <Pencil size={14} />
                            </button>
                          )}
                          {!isDeleted && canDelete && (
                            <button onClick={() => setDeleteTarget(item)} title="Supprimer"
                              className="rounded-md p-1.5 text-neutral-500 hover:bg-red-50 hover:text-[#E10600]">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && rows.length > 0 && (
          <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3 text-sm text-neutral-500">
            <span>{total} node{total > 1 ? 's' : ''} au total</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40">Précédent</button>
              <span className="text-xs">Page {page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40">Suivant</button>
            </div>
          </div>
        )}
      </div>

      {drawer && (
        <NodeDrawer
          editNode={drawer.editNode}
          onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); fetchNodes(); }}
          showToast={showToast}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="font-poppins text-base font-semibold text-neutral-900">Supprimer ce node ?</h3>
            <p className="mt-2 text-sm text-neutral-500">
              <span className="font-medium text-neutral-700">{deleteTarget.name_fr}</span> passera au statut "Supprimé".
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100">Annuler</button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c00500] disabled:opacity-60">
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}