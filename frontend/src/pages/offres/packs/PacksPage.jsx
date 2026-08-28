import { useEffect, useMemo, useState, useCallback } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { getPacks, togglePackActive, deletePack } from '../../../api/offres.api';
import { getNodes } from '../../../api/locationNode.api';
import PackDetailDrawer from './PackDetail';

// --- small presentational helpers ---------------------------------------

function StatusBadge({ active }) {
  return (
    <span
      className={
        'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ' +
        (active
          ? 'bg-emerald-50 text-emerald-600'
          : 'bg-gray-100 text-gray-500')
      }
    >
      {active ? 'Actif' : 'Inactif'}
    </span>
  );
}

function VisibilityBadge({ visible }) {
  return (
    <span
      className={
        'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ' +
        (visible
          ? 'bg-emerald-50 text-emerald-600'
          : 'bg-red-50 text-red-500')
      }
    >
      {visible ? 'Visible app' : 'Masqué app'}
    </span>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors ' +
        (checked ? 'bg-emerald-500' : 'bg-gray-300') +
        (disabled ? ' opacity-50 cursor-not-allowed' : ' cursor-pointer')
      }
    >
      <span
        className={
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ' +
          (checked ? 'translate-x-4.5' : 'translate-x-1')
        }
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  );
}

function money(n) {
  return `${Number(n ?? 0).toFixed(2)} MAD`;
}

function formatTime(date) {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// --- main page ------------------------------------------------------------

export default function PackPage() {
  const { hasPermission } = useAuth();
  const canView   = hasPermission('packs.view');
  const canCreate = hasPermission('packs.create');
  const canUpdate = hasPermission('packs.update');
  const canDelete = hasPermission('packs.delete');

  const [packs, setPacks] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [nodeFilter, setNodeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '', 'true', 'false'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(new Date());
  const [togglingId, setTogglingId] = useState(null);
  const [drawerState, setDrawerState] = useState(null); // null | { packId: string|null }

  useEffect(() => {
    getNodes()
      .then(({ data }) => setNodes(data.data ?? data ?? []))
      .catch(() => setNodes([]));
  }, []);

  const nodesById = useMemo(() => {
    const map = new Map();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (nodeFilter) params.node_id = nodeFilter;
      if (statusFilter) params.is_active = statusFilter;
      const { data } = await getPacks(params);
      setPacks(data.data ?? []);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err?.response?.data?.message ?? "Impossible de charger les packs");
    } finally {
      setLoading(false);
    }
  }, [canView, nodeFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleToggleActive(pack, nextValue) {
    setTogglingId(pack.id);
    // optimistic update
    setPacks((prev) => prev.map((p) => (p.id === pack.id ? { ...p, is_active: nextValue } : p)));
    try {
      await togglePackActive(pack.id, nextValue);
    } catch (err) {
      // revert on failure
      setPacks((prev) => prev.map((p) => (p.id === pack.id ? { ...p, is_active: pack.is_active } : p)));
      alert(err?.response?.data?.message ?? "Échec de la mise à jour du statut");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(pack) {
    if (!window.confirm(`Supprimer le pack "${pack.name_fr}" ?`)) return;
    try {
      await deletePack(pack.id);
      setPacks((prev) => prev.filter((p) => p.id !== pack.id));
    } catch (err) {
      alert(err?.response?.data?.message ?? "Échec de la suppression");
    }
  }

  function handleDrawerSaved(result) {
    if (result?.deleted) {
      setPacks((prev) => prev.filter((p) => p.id !== result.deleted));
    } else {
      load();
    }
  }

  if (!canView) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-gray-400">
        <Lock size={28} />
        <p className="text-sm">Vous n'avez pas accès à cette page.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h1 className="text-lg font-semibold text-gray-900">Packs / Bundles</h1>
          <span className="flex items-center gap-1.5 text-xs text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Mis à jour à {formatTime(updatedAt)}
          </span>
        </div>

        {/* filters */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex gap-3">
            <select
              value={nodeFilter}
              onChange={(e) => setNodeFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              <option value="">Tous les nœuds</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.code ?? n.name}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              <option value="">Tous statuts</option>
              <option value="true">Actif</option>
              <option value="false">Inactif</option>
            </select>
          </div>

          <button
            onClick={() => setDrawerState({ packId: null })}
            disabled={!canCreate}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Nouveau pack
          </button>
        </div>

        {/* table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-y border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <th className="whitespace-nowrap px-6 py-3 font-medium">Pack (FR / AR)</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Nœud</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Prix pack</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Prix composants</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Assemblables</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Max vente</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">is_available</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Statut</th>
                <th className="whitespace-nowrap px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={9} className="px-6 py-8 text-center text-gray-400">Chargement…</td></tr>
              )}

              {!loading && error && (
                <tr><td colSpan={9} className="px-6 py-8 text-center text-red-500">{error}</td></tr>
              )}

              {!loading && !error && packs.length === 0 && (
                <tr><td colSpan={9} className="px-6 py-8 text-center text-gray-400">Aucun pack trouvé</td></tr>
              )}

              {!loading && !error && packs.map((pack) => {
                const assemblableCount = pack.assemblable_count ?? 0;
                const vendableCount = pack.vendable_count ?? 0;
                const maxVente = pack.max_pack_qty ?? '—';
                const isAvailable = pack.is_available ?? false;
                const node = nodesById.get(pack.node_id);
                const nodeLabel = node ? (node.code ?? node.name) : (pack.node_id ?? '—');

                return (
                  <tr key={pack.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="font-medium text-gray-900">{pack.name_fr}</div>
                      <div className="text-gray-400" dir="rtl">{pack.name_ar}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-gray-600">{nodeLabel}</td>
                    <td className="whitespace-nowrap px-4 py-4 font-semibold text-emerald-600">{money(pack.total_price)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-gray-400 line-through">{money(pack.original_price)}</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className={assemblableCount > 0 ? 'font-semibold text-amber-500' : 'font-semibold text-red-500'}>
                        {assemblableCount}
                      </span>
                      <span className="text-gray-400"> (vendable : {vendableCount})</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-gray-600">{maxVente}</td>
                    <td className="whitespace-nowrap px-4 py-4"><VisibilityBadge visible={isAvailable} /></td>
                    <td className="whitespace-nowrap px-4 py-4"><StatusBadge active={pack.is_active} /></td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setDrawerState({ packId: pack.id })}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Détail
                        </button>
                        {canUpdate && (
                          <Toggle
                            checked={!!pack.is_active}
                            disabled={togglingId === pack.id}
                            onChange={(next) => handleToggleActive(pack, next)}
                          />
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(pack)}
                            className="text-red-500 hover:text-red-600"
                          >
                            Supprimer
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
      </div>

      {drawerState && (
        <PackDetailDrawer
          packId={drawerState.packId}
          nodes={nodes}
          defaultNodeId={nodeFilter || null}
          onClose={() => setDrawerState(null)}
          onSaved={handleDrawerSaved}
        />
      )}
    </div>
  );
}