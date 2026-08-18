import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Zap, Tag, Trash2, Pencil, Power, PowerOff, Lock, Search, ImageOff } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { promotionsApi } from '../../../api/promotions.api';

const TABS = [
  { key: 'flash', label: 'Ventes Flash', icon: Zap, scopes: ['sku', 'pack'] },
  { key: 'promo', label: 'Autres Promotions', icon: Tag, scopes: ['category', 'brand'] },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
  { value: 'deleted', label: 'Supprimé' },
];

function StatusBadge({ promo }) {
  if (promo.status === 'deleted') {
    return <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">Supprimé</span>;
  }
  if (promo.status === 'expired') {
    return <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Expiré</span>;
  }
  if (promo.status === 'active') {
    return <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Actif</span>;
  }
  return <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">Inactif</span>;
}

export default function PromotionsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('promotions.view');
  const canCreate = hasPermission('promotions.create');
  const canUpdate = hasPermission('promotions.update');
  const canDelete = hasPermission('promotions.delete');

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('flash');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await promotionsApi.getAll({
        limit: 200,
        ...(status && { status }),
        ...(search && { search }),
      });
      setItems(data.data ?? []);
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [canView, status, search]);

  useEffect(() => {
    const t = setTimeout(fetchAll, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [fetchAll]);

  const activeScopes = TABS.find(t => t.key === activeTab).scopes;
  const filtered = useMemo(
    () => items.filter(p => activeScopes.includes(p.scope_type)),
    [items, activeScopes]
  );

  async function handleToggleStatus(promo) {
    setTogglingId(promo.id);
    try {
      await promotionsApi.update(promo.id, { is_active: !promo.is_active });
      fetchAll();
    } catch (err) {
      alert(err?.response?.data?.message ?? 'Erreur');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(promo) {
    if (!confirm(`Supprimer "${promo.name_fr || promo.scope_name}" ?`)) return;
    try {
      await promotionsApi.remove(promo.id);
      fetchAll();
    } catch (err) {
      alert(err?.response?.data?.message ?? 'Erreur');
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
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Promotions</h1>
          <p className="mt-1 text-sm text-neutral-500">Ventes flash et remises catégorie/marque.</p>
        </div>
        {canCreate && (
          <button
            className="flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#c00500] active:scale-[0.98]"
            onClick={() => {/* ouvrir drawer création, scope pré-rempli selon activeTab */}}
          >
            <Plus size={18} />
            {activeTab === 'flash' ? 'Nouvelle vente flash' : 'Nouvelle promotion'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200 mb-4">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const count = items.filter(p => tab.scopes.includes(p.scope_type)).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                isActive ? 'border-[#E10600] text-[#E10600]' : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <Icon size={16} />
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-[#E10600]/10 text-[#E10600]' : 'bg-neutral-100 text-neutral-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtres */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (nom, SKU)…"
            className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#E10600] focus:ring-2 focus:ring-[#E10600]/15"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E10600] focus:ring-2 focus:ring-[#E10600]/15"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Image</th>
              <th className="px-4 py-3 font-medium">Nom / Portée</th>
              <th className="px-4 py-3 font-medium">Réduction</th>
              {activeTab === 'flash' && <th className="px-4 py-3 font-medium">Prix</th>}
              <th className="px-4 py-3 font-medium">Période</th>
              {activeTab === 'flash' && <th className="px-4 py-3 font-medium">Stock</th>}
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-neutral-400">Chargement...</td></tr>
            ) : error ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-red-500">{error}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-neutral-400">
                Aucune {activeTab === 'flash' ? 'vente flash' : 'promotion'} trouvée.
              </td></tr>
            ) : (
              filtered.map((promo) => {
                const isDeleted = promo.status === 'deleted';
                const isPct = promo.discount_type === 'percentage' || promo.discount_type === 'pourcentage';
                return (
                  <tr key={promo.id} className={`transition hover:bg-neutral-50 ${isDeleted ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      {promo.image_url ? (
                        <img src={promo.image_url} alt={promo.name_fr} className="h-10 w-10 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-100 text-neutral-300">
                          <ImageOff size={16} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-800">{promo.name_fr || promo.scope_name || '—'}</p>
                      <p className="text-xs text-neutral-400 capitalize">
                        {promo.scope_type} {promo.product_count != null && `· ${promo.product_count} article(s)`}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-medium text-[#E10600]">
                      {isPct ? `-${promo.discount_value}%` : `-${promo.discount_value} MAD`}
                    </td>
                    {activeTab === 'flash' && (
                      <td className="px-4 py-3">
                        {promo.old_price != null ? (
                          <>
                            <span className="line-through text-neutral-400 mr-1">{promo.old_price} MAD</span>
                            <span className="font-medium text-neutral-800">{promo.new_price} MAD</span>
                          </>
                        ) : '—'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-neutral-500 text-xs whitespace-nowrap">
                      {new Date(promo.starts_at).toLocaleDateString('fr-FR')} → {new Date(promo.ends_at).toLocaleDateString('fr-FR')}
                    </td>
                    {activeTab === 'flash' && (
                      <td className="px-4 py-3 text-neutral-600">
                        {promo.remaining_stock != null ? promo.remaining_stock : '—'}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <StatusBadge promo={promo} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {!isDeleted && canUpdate && (
                          <button
                            onClick={() => handleToggleStatus(promo)}
                            disabled={togglingId === promo.id}
                            className={`rounded-lg p-2 transition disabled:opacity-50 ${
                              promo.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-neutral-400 hover:bg-neutral-100'
                            }`}
                            title={promo.is_active ? 'Désactiver' : 'Activer'}
                          >
                            {promo.is_active ? <Power size={16} /> : <PowerOff size={16} />}
                          </button>
                        )}
                        {!isDeleted && canUpdate && (
                          <button
                            onClick={() => {/* ouvrir drawer édition avec promo */}}
                            className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
                            title="Modifier"
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {!isDeleted && canDelete && (
                          <button
                            onClick={() => handleDelete(promo)}
                            className="rounded-lg p-2 text-neutral-500 transition hover:bg-red-50 hover:text-[#E10600]"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
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
    </div>
  );
}