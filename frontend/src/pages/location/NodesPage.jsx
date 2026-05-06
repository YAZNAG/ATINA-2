import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import * as api from '../../api/locationNode.api';

// ── Icons ─────────────────────────────────────────────────────────────────────

const PATH = {
  plus:     'M12 4v16m8-8H4',
  edit:     'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:    'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  search:   'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  node:     'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4',
  mapPin:   'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  phone:    'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  x:        'M6 18L18 6M6 6l12 12',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ active }) {
  return active ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Actif
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      Inactif
    </span>
  );
}

// ── Node card ─────────────────────────────────────────────────────────────────

function NodeCard({ node, onEdit, onDelete }) {
  const badgeColor = node.node_type?.color_badge || '#dc2626';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all flex flex-col">
      <div className="flex-1 p-5">
        {/* Icon + name */}
        <div className="flex items-start gap-4 mb-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
            style={{ background: `linear-gradient(135deg, ${badgeColor}bb, ${badgeColor})` }}
          >
            {node.node_type?.icon ? (
              <span className="text-2xl">{node.node_type.icon}</span>
            ) : (
              <Icon d={PATH.node} className="w-7 h-7 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-sm leading-tight">{node.name_fr}</h3>
            {node.name_ar && (
              <p className="text-xs text-gray-400 mt-0.5 truncate" dir="rtl">{node.name_ar}</p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-mono rounded-md border border-gray-200">
                {node.code}
              </span>
              <StatusBadge active={node.is_active} />
            </div>
          </div>
        </div>

        {/* Type badge */}
        {node.node_type && (
          <div className="mb-2">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold text-white"
              style={{ background: badgeColor }}
            >
              {node.node_type.icon && <span>{node.node_type.icon}</span>}
              {node.node_type.name_fr}
            </span>
          </div>
        )}

        {/* Location info */}
        <div className="space-y-1 mt-2">
          {node.city?.name_fr && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Icon d={PATH.mapPin} className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
              <span className="truncate">
                {node.city.name_fr}
                {node.address_line1 && ` — ${node.address_line1}`}
                {node.quartier && `, ${node.quartier}`}
              </span>
            </div>
          )}
          {node.phone && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Icon d={PATH.phone} className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
              <span>{node.phone}</span>
            </div>
          )}
          {node.delivery_radius_km && (
            <div className="text-[11px] text-gray-400 mt-1">
              Rayon livraison : <span className="font-semibold text-gray-600">{node.delivery_radius_km} km</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 px-4 pb-4 pt-3 border-t border-gray-50">
        <button
          onClick={() => onEdit(node)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
        >
          <Icon d={PATH.edit} className="w-3.5 h-3.5" />
          Modifier
        </button>
        <button
          onClick={() => onDelete(node)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors ml-auto"
        >
          <Icon d={PATH.trash} className="w-3.5 h-3.5" />
          Supprimer
        </button>
      </div>
    </div>
  );
}

// ── Delete modal ──────────────────────────────────────────────────────────────

function DeleteModal({ item, onCancel, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Icon d={PATH.trash} className="w-7 h-7 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Confirmer la suppression</h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          Le nœud <span className="font-semibold text-gray-700">«{item?.name_fr}»</span> sera supprimé définitivement.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function NodesPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const [nodes, setNodes]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchInput, setSearchInput]   = useState('');
  const [search, setSearch]             = useState('');
  const [typeFilter, setTypeFilter]     = useState('all');
  const [nodeTypes, setNodeTypes]       = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nodesRes, typesRes] = await Promise.all([
        api.getNodes({ limit: 500 }),
        api.getNodeTypes(),
      ]);
      setNodes(nodesRes.data.data ?? []);
      setNodeTypes(typesRes.data.data ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.deleteNode(deleting.id);
      toast.success('Nœud supprimé');
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── filtered list ────────────────────────────────────────────────────────────

  const q = search.toLowerCase();
  const filtered = nodes.filter((n) => {
    if (statusFilter === 'active'   && !n.is_active) return false;
    if (statusFilter === 'inactive' &&  n.is_active) return false;
    if (typeFilter !== 'all' && n.node_type_id !== typeFilter) return false;
    if (q && !(n.name_fr ?? '').toLowerCase().includes(q) && !(n.code ?? '').toLowerCase().includes(q)) return false;
    return true;
  });

  const totalActive   = nodes.filter((n) => n.is_active).length;
  const totalInactive = nodes.filter((n) => !n.is_active).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {deleting && (
        <DeleteModal
          item={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
          loading={deleteLoading}
        />
      )}

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Noeuds</h1>
              <p className="text-sm text-gray-400 mt-0.5">Entrepôts, dark stores, hubs logistiques</p>
            </div>
            {hasPermission('nodes.create') && (
              <button
                onClick={() => navigate('/nodes/new')}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all flex-shrink-0"
              >
                <Icon d={PATH.plus} className="w-4 h-4" />
                Nouveau nœud
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status filter */}
            <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
              {[{ v: 'all', l: 'Tous' }, { v: 'active', l: 'Actif' }, { v: 'inactive', l: 'Inactif' }].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setStatusFilter(opt.v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    statusFilter === opt.v ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>

            {/* Type filter */}
            {nodeTypes.length > 0 && (
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs font-semibold border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">Tous les types</option>
                {nodeTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name_fr}</option>
                ))}
              </select>
            )}

            {/* Search */}
            <form
              onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); }}
              className="flex items-center gap-2 flex-1 min-w-0 max-w-sm"
            >
              <div className="relative flex-1">
                <Icon d={PATH.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Rechercher par nom, code…"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                />
              </div>
              <button type="submit" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors flex-shrink-0">
                Filtrer
              </button>
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setSearchInput(''); }}
                  className="px-2.5 py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50"
                >
                  ✕
                </button>
              )}
            </form>

            <span className="text-xs text-gray-400 ml-auto">
              {filtered.length} nœud{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      {nodes.length > 0 && (
        <div className="px-6 pt-4 pb-0">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total noeuds', value: nodes.length,  color: 'bg-red-50 border-red-100 text-red-700' },
              { label: 'Actifs',       value: totalActive,   color: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
              { label: 'Inactifs',     value: totalInactive, color: 'bg-gray-50 border-gray-100 text-gray-600' },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.color}`}>
                <p className="text-xs font-semibold opacity-70 uppercase tracking-wide">{s.label}</p>
                <p className="text-2xl font-bold mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
            <p className="text-sm text-gray-400">Chargement…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-red-50 border border-red-100">
              <Icon d={PATH.node} className="w-10 h-10 text-red-200" />
            </div>
            <div className="text-center">
              <p className="text-gray-600 font-semibold">Aucun nœud trouvé</p>
              <p className="text-gray-400 text-sm mt-1">
                {search || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'Essayez de modifier vos filtres.'
                  : 'Cliquez sur « Nouveau nœud » pour commencer.'}
              </p>
            </div>
            {!search && statusFilter === 'all' && typeFilter === 'all' && hasPermission('nodes.create') && (
              <button
                onClick={() => navigate('/nodes/new')}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                + Créer le premier nœud
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                onEdit={(n) => navigate(`/nodes/${n.id}/edit`)}
                onDelete={(n) => setDeleting(n)}
              />
            ))}

            {/* Add card */}
            {hasPermission('nodes.create') && (
              <button
                onClick={() => navigate('/nodes/new')}
                className="rounded-2xl border-2 border-dashed border-red-200 hover:border-red-400 bg-white hover:bg-red-50 text-red-400 hover:text-red-600 transition-all flex flex-col items-center justify-center gap-3 p-8 min-h-[200px]"
              >
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                  <Icon d={PATH.plus} className="w-6 h-6 text-red-500" />
                </div>
                <span className="text-sm font-semibold">Ajouter un nœud</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
