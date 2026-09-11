import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, Download, Lock, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { getPacks, activatePack, deactivatePack } from '../../../api/packs.api';
import { getNodes } from '../../../api/locationNode.api';
import PackDetail from './PackDetail';
import PackAvailability from './PackAvailability';
import { DuplicatePackModal, DeletePackModal } from './PackDialogs';
import {
  money, nodeLabel, apiError, formatDate, StatusBadge, VisibilityBadge, Toggle, exportCsv, capLabel, vendableLabel,
} from './packUi';

/**
 * Offres › Packs / Bundles — onglets du classeur :
 *   « Liste des packs » | « Détail pack & composition » | « Disponibilité & assemblables ».
 */
const TABS = [
  { key: 'list',         label: 'Liste des packs' },
  { key: 'detail',       label: 'Détail pack & composition' },
  { key: 'availability', label: 'Disponibilité & assemblables' },
];

const PAGE_SIZE = 20;

export default function PacksPage() {
  const { hasPermission } = useAuth();
  const any = (...codes) => codes.some((c) => hasPermission(c));
  const perms = {
    canView:   any('packs.view', 'dashboard.view'),
    canCreate: any('packs.create', 'dashboard.view'),
    canUpdate: any('packs.update', 'dashboard.view'),
    canDelete: any('packs.delete', 'dashboard.view'),
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'list');
  const [selectedId, setSelectedId] = useState(() => searchParams.get('pack') || null);
  const [creating, setCreating] = useState(false);

  const [nodes, setNodes] = useState([]);
  const [filters, setFilters] = useState({ node_id: '', status: '', period: '', search: '' });
  const [page, setPage] = useState(1);
  const [packs, setPacks] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [dupPack, setDupPack] = useState(null);
  const [delPack, setDelPack] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getNodes({ limit: 500 })
      .then(({ data }) => setNodes(data.data ?? []))
      .catch(() => setNodes([]));
  }, []);

  // Onglet / pack sélectionné reflétés dans l'URL (liens partageables).
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', activeTab);
    if (selectedId) next.set('pack', selectedId); else next.delete('pack');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedId]);

  const buildParams = useCallback((extra = {}) => {
    const params = { page, limit: PAGE_SIZE, ...extra };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    return params;
  }, [filters, page]);

  const load = useCallback(async () => {
    if (!perms.canView) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await getPacks(buildParams());
      setPacks(data.data ?? []);
      setPagination(data.pagination ?? data.meta ?? { total: 0, page: 1, pages: 1 });
    } catch (err) {
      setError(apiError(err, 'Impossible de charger les packs'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildParams, perms.canView]);

  useEffect(() => {
    const t = setTimeout(load, filters.search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, filters.search]);

  useEffect(() => { setPage(1); }, [filters]);

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  function openPack(id) {
    setCreating(false);
    setSelectedId(id);
    setActiveTab('detail');
  }

  function openNew() {
    setSelectedId(null);
    setCreating(true);
    setActiveTab('detail');
  }

  async function handleToggle(p, next) {
    setTogglingId(p.id);
    try {
      const { data } = next ? await activatePack(p.id) : await deactivatePack(p.id);
      setPacks((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...data.data } : x)));
    } catch (err) {
      setError(apiError(err, 'Échec du changement de statut'));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const { data } = await getPacks(buildParams({ all: true, page: 1 }));
      const rows = (data.data ?? []).map((p) => [
        p.name_fr, p.name_ar, nodeLabel(p.node, nodes, p.node_id),
        Number(p.total_price).toFixed(2), Number(p.original_price).toFixed(2), p.discount_pct,
        p.assemblable_count, p.max_pack_qty ?? '', p.sold_count, vendableLabel(p),
        p.is_available ? 'Visible' : 'Masqué', p.is_active ? 'Actif' : 'Inactif',
        p.valid_from ? formatDate(p.valid_from) : '', p.valid_to ? formatDate(p.valid_to) : '',
      ]);
      exportCsv(`packs_${new Date().toISOString().slice(0, 10)}.csv`, [
        'Nom FR', 'Nom AR', 'Node', 'Prix pack', 'Prix original', 'Remise %', 'Assemblables', 'max_pack_qty',
        'Vendus', 'Qté vendable', 'Visibilité app', 'Statut', 'Début', 'Fin',
      ], rows);
    } catch (err) {
      setError(apiError(err, "Échec de l'export"));
    } finally {
      setExporting(false);
    }
  }

  if (!perms.canView) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-400">
        <Lock size={28} />
        <p className="text-sm">Vous n'avez pas accès à cette page.</p>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Packs / Bundles</h1>
          <p className="page-subtitle">Offres groupées de SKU, rattachées à un node, avec disponibilité assemblable calculée à la volée.</p>
        </div>
        {perms.canCreate && (
          <button type="button" onClick={openNew} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700">
            <Plus size={16} /> Nouveau pack
          </button>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              activeTab === t.key ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'list' && (
        <div className="space-y-4">
          <div className="card flex flex-col gap-3 !p-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="form-label">Recherche</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="form-input !pl-9" placeholder="Nom FR / AR" value={filters.search} onChange={setFilter('search')} />
                </div>
              </div>
              <div>
                <label className="form-label">Node</label>
                <select className="form-select" value={filters.node_id} onChange={setFilter('node_id')}>
                  <option value="">Tous les nodes</option>
                  {nodes.map((n) => <option key={n.id} value={n.id}>{nodeLabel(n)}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Statut</label>
                <select className="form-select" value={filters.status} onChange={setFilter('status')}>
                  <option value="">Tous statuts</option>
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>
              <div>
                <label className="form-label">Période de validité</label>
                <select className="form-select" value={filters.period} onChange={setFilter('period')}>
                  <option value="">Toutes périodes</option>
                  <option value="current">En cours</option>
                  <option value="upcoming">À venir</option>
                  <option value="expired">Expirés</option>
                </select>
              </div>
            </div>
            <button type="button" className="btn-secondary" onClick={handleExport} disabled={exporting}>
              <Download size={16} /> {exporting ? 'Export…' : 'Exporter'}
            </button>
          </div>

          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

          <div className="table-wrap">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="table-th">Pack (FR / AR)</th>
                    <th className="table-th">Node</th>
                    <th className="table-th">Prix</th>
                    <th className="table-th">Assemblables</th>
                    <th className="table-th">Vendus / max</th>
                    <th className="table-th">Qté vendable</th>
                    <th className="table-th">Visibilité app</th>
                    <th className="table-th">Période</th>
                    <th className="table-th">Statut</th>
                    <th className="table-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && <tr><td colSpan={10} className="table-td py-8 text-center text-slate-400">Chargement…</td></tr>}
                  {!loading && packs.length === 0 && (
                    <tr><td colSpan={10} className="table-td py-10 text-center text-slate-400">Aucun pack ne correspond à ces filtres.</td></tr>
                  )}
                  {!loading && packs.map((p) => (
                    <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openPack(p.id)}>
                      <td className="table-td">
                        <div className="font-medium text-slate-800">{p.name_fr}</div>
                        <div className="text-xs text-slate-400" dir="rtl">{p.name_ar}</div>
                      </td>
                      <td className="table-td whitespace-nowrap">{nodeLabel(p.node, nodes, p.node_id)}</td>
                      <td className="table-td whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{money(p.total_price)}</div>
                        {p.original_price > p.total_price && (
                          <div className="text-xs text-slate-400"><span className="line-through">{money(p.original_price)}</span> · -{p.discount_pct} %</div>
                        )}
                      </td>
                      <td className="table-td">
                        <span className={`font-semibold ${p.assemblable_count > 0 ? 'text-slate-800' : 'text-red-600'}`}>{p.assemblable_count}</span>
                        {p.unavailable_components > 0 && <div className="text-xs text-amber-600">{p.unavailable_components} composant(s) indispo.</div>}
                      </td>
                      <td className="table-td">{capLabel(p)}</td>
                      <td className="table-td">{vendableLabel(p)}</td>
                      <td className="table-td"><VisibilityBadge visible={p.is_available} /></td>
                      <td className="table-td whitespace-nowrap text-xs text-slate-500">
                        {p.valid_from || p.valid_to ? `${formatDate(p.valid_from)} → ${p.valid_to ? formatDate(p.valid_to) : '…'}` : 'Permanente'}
                      </td>
                      <td className="table-td"><StatusBadge active={p.is_active} /></td>
                      <td className="table-td" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {perms.canUpdate && (
                            <Toggle checked={!!p.is_active} disabled={togglingId === p.id} onChange={(v) => handleToggle(p, v)} title="Activer / Désactiver" />
                          )}
                          {perms.canCreate && (
                            <button type="button" className="btn-icon-edit" title="Dupliquer vers un node" onClick={() => setDupPack(p)}><Copy size={15} /></button>
                          )}
                          {perms.canDelete && (
                            <button type="button" className="btn-icon-delete" title="Supprimer" onClick={() => setDelPack(p)}><Trash2 size={15} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
                <span>{pagination.total} pack(s)</span>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary !py-1.5" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>Précédent</button>
                  <span className="self-center">Page {page} / {pagination.pages}</span>
                  <button type="button" className="btn-secondary !py-1.5" disabled={page >= pagination.pages} onClick={() => setPage((x) => x + 1)}>Suivant</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'detail' && (
        (selectedId || (creating && perms.canCreate)) ? (
          <PackDetail
            key={selectedId || 'new'}
            packId={selectedId}
            nodes={nodes}
            defaultNodeId={filters.node_id || null}
            perms={perms}
            onSaved={(saved, meta) => {
              load();
              if (meta?.created && !meta?.silent && saved?.id) { setCreating(false); setSelectedId(saved.id); }
            }}
            onDeleted={() => { setSelectedId(null); setCreating(false); setActiveTab('list'); load(); }}
            onOpenPack={openPack}
          />
        ) : (
          <div className="card space-y-3 py-12 text-center text-sm text-slate-400">
            <p>Sélectionnez un pack dans la « Liste des packs »{perms.canCreate ? ' ou créez-en un nouveau' : ''}.</p>
            {perms.canCreate && (
              <button type="button" onClick={openNew} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                <Plus size={16} /> Nouveau pack
              </button>
            )}
          </div>
        )
      )}

      {activeTab === 'availability' && (
        <PackAvailability nodes={nodes} perms={perms} initialNodeId={filters.node_id} onOpenPack={openPack} />
      )}

      <DuplicatePackModal
        open={!!dupPack}
        pack={dupPack}
        nodes={nodes}
        onClose={() => setDupPack(null)}
        onDuplicated={() => load()}
        onOpenPack={(id) => { setDupPack(null); openPack(id); }}
      />
      <DeletePackModal
        open={!!delPack}
        pack={delPack}
        canDeactivate={perms.canUpdate}
        onClose={() => setDelPack(null)}
        onDeleted={() => load()}
        onDeactivated={() => load()}
      />
    </div>
  );
}
