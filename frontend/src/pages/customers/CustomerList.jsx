import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCustomers } from '../../api/customers.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';
import CustomerShell, { catalogInputClass, catalogSelectClass } from './CustomerShell';

const defaultFilters = {
  search: '',
  phone: '',
  city: '',
  preferred_lang: '',
  is_active: '',
  is_deleted_scope: 'active',
  phone_verified: '',
  has_wallet_balance: '',
  has_points: '',
};

function scopeToParam(scope) {
  if (scope === 'deleted') return { is_deleted: 'true' };
  if (scope === 'all') return { is_deleted: 'all' };
  return {};
}

function CustomerStatusPill({ c }) {
  if (c.is_deleted) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Supprimé
      </span>
    );
  }
  if (!c.is_active) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        Bloqué
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Actif
    </span>
  );
}

function CustomerCard({ c, canUpdate }) {
  const navigate = useNavigate();
  const initial = (c.name || '?').charAt(0).toUpperCase();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all flex flex-col">
      <div className="p-5 flex-1">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 to-red-500 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-white font-bold text-xl">{initial}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">{c.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate font-mono">
              {c.phone_country} {c.phone_number}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {c.referral_code ? (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-mono rounded-md border border-gray-200">
                  {c.referral_code}
                </span>
              ) : null}
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-semibold rounded-md uppercase">
                {c.preferred_lang}
              </span>
              <CustomerStatusPill c={c} />
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 font-medium truncate">
          {c.city || '—'} · Wallet {c.wallet_balance ?? '0'} · {c.points_balance ?? 0} pts · {formatDate(c.created_at)}
        </p>
      </div>

      <div className="flex items-center gap-1.5 px-4 pb-4 pt-3 border-t border-gray-50">
        <Link
          to={`/customers/${c.id}`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Détails
        </Link>
        {canUpdate && !c.is_deleted ? (
          <button
            type="button"
            onClick={() => navigate(`/customers/${c.id}/edit`)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Modifier
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function CustomerList() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canView = hasPermission('customers.view') || hasPermission('dashboard.view');
  const canCreate = hasPermission('customers.create') || hasPermission('dashboard.view');
  const canUpdate = hasPermission('customers.update') || hasPermission('dashboard.view');

  const [filters, setFilters] = useState(defaultFilters);
  const [applied, setApplied] = useState(defaultFilters);
  const [searchInput, setSearchInput] = useState('');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchList = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    const { is_deleted_scope, ...rest } = applied;
    const params = {
      page,
      limit,
      ...scopeToParam(is_deleted_scope),
    };
    if (rest.search.trim()) params.search = rest.search.trim();
    if (rest.phone.trim()) params.phone = rest.phone.trim();
    if (rest.city.trim()) params.city = rest.city.trim();
    if (rest.preferred_lang === 'fr' || rest.preferred_lang === 'ar') params.preferred_lang = rest.preferred_lang;
    if (rest.is_active === 'true' || rest.is_active === 'false') params.is_active = rest.is_active;
    if (rest.phone_verified === 'true' || rest.phone_verified === 'false') params.phone_verified = rest.phone_verified;
    if (rest.has_wallet_balance === 'true') params.has_wallet_balance = 'true';
    if (rest.has_points === 'true') params.has_points = 'true';

    try {
      const res = await getCustomers(params);
      const payload = res.data?.data;
      setItems(payload?.items ?? []);
      const pg = payload?.pagination;
      if (pg) {
        setTotal(pg.total ?? 0);
        setTotalPages(pg.totalPages ?? 0);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [canView, applied, page, limit]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const syncSearchInput = () => {
    setSearchInput(applied.search);
  };

  useEffect(() => {
    syncSearchInput();
  }, [applied.search]);

  const applyFilters = (e) => {
    e?.preventDefault();
    const s = searchInput.trim();
    setFilters((f) => {
      const next = { ...f, search: s };
      setApplied({ ...next, search: s });
      setPage(1);
      return next;
    });
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setSearchInput('');
    setApplied(defaultFilters);
    setPage(1);
  };

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const patchFilters = (patch) => {
    setFilters((f) => {
      const next = { ...f, ...patch };
      setApplied({ ...next, search: searchInput.trim() });
      setPage(1);
      return next;
    });
  };

  if (!canView) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-600 text-sm py-16">
        Accès refusé.
      </div>
    );
  }

  const headerBottom = (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          {[
            { v: '', l: 'Tous comptes' },
            { v: 'true', l: 'Actif' },
            { v: 'false', l: 'Bloqué' },
          ].map((opt) => (
            <button
              key={opt.l}
              type="button"
              onClick={() => patchFilters({ is_active: opt.v })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filters.is_active === opt.v ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {opt.l}
            </button>
          ))}
        </div>

        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          {[
            { v: 'active', l: 'Actifs (non suppr.)' },
            { v: 'deleted', l: 'Supprimés' },
            { v: 'all', l: 'Tous' },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => patchFilters({ is_deleted_scope: opt.v })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                filters.is_deleted_scope === opt.v ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {opt.l}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters(e);
          }}
          className="flex items-center gap-2 flex-1 min-w-0 max-w-md"
        >
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rechercher…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors flex-shrink-0">
            Go
          </button>
          {applied.search ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setFilters((f) => ({ ...f, search: '' }));
                setApplied((a) => ({ ...a, search: '' }));
                setPage(1);
              }}
              className="px-2.5 py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50"
            >
              ✕
            </button>
          ) : null}
        </form>

        <span className="text-xs text-gray-400 ml-auto">{total} client{total !== 1 ? 's' : ''}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Téléphone</label>
          <input className={catalogInputClass} value={filters.phone} onChange={(e) => setFilter('phone', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Ville</label>
          <input className={catalogInputClass} value={filters.city} onChange={(e) => setFilter('city', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Langue</label>
          <select className={catalogSelectClass} value={filters.preferred_lang} onChange={(e) => setFilter('preferred_lang', e.target.value)}>
            <option value="">Toutes</option>
            <option value="fr">FR</option>
            <option value="ar">AR</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tél. vérifié</label>
          <select className={catalogSelectClass} value={filters.phone_verified} onChange={(e) => setFilter('phone_verified', e.target.value)}>
            <option value="">—</option>
            <option value="true">Oui</option>
            <option value="false">Non</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Wallet &gt; 0</label>
          <select className={catalogSelectClass} value={filters.has_wallet_balance} onChange={(e) => setFilter('has_wallet_balance', e.target.value)}>
            <option value="">—</option>
            <option value="true">Oui</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Points &gt; 0</label>
          <select className={catalogSelectClass} value={filters.has_points} onChange={(e) => setFilter('has_points', e.target.value)}>
            <option value="">—</option>
            <option value="true">Oui</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={applyFilters} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors">
          Appliquer les filtres
        </button>
        <button type="button" onClick={resetFilters} className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors">
          Réinitialiser
        </button>
      </div>
    </div>
  );

  const addButton = canCreate ? (
    <button
      type="button"
      onClick={() => navigate('/customers/new')}
      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
      </svg>
      Ajouter
    </button>
  ) : null;

  return (
    <CustomerShell
      crumbLabel="Gestion des clients"
      title="Gestion des clients"
      pageSubtitle="Clients application mobile — même présentation que les référentiels catalogue (cartes, filtres, actions)."
      headerRight={addButton}
      headerBottom={headerBottom}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
          <p className="text-sm text-gray-400">Chargement…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-20 h-20 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="text-center max-w-sm">
            <p className="text-gray-600 font-semibold">Aucun client</p>
            <p className="text-gray-400 text-sm mt-1">
              Modifiez les filtres ou exécutez <span className="font-mono text-slate-500">npm run db:seed</span> dans le dossier backend pour les données démo.
            </p>
          </div>
          {canCreate ? (
            <button
              type="button"
              onClick={() => navigate('/customers/new')}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              + Créer le premier
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((c) => (
              <CustomerCard key={c.id} c={c} canUpdate={canUpdate} />
            ))}
            {canCreate ? (
              <button
                type="button"
                onClick={() => navigate('/customers/new')}
                className="rounded-2xl border-2 border-dashed border-red-200 hover:border-red-400 bg-white hover:bg-red-50 transition-all flex flex-col items-center justify-center gap-3 p-8 text-red-400 hover:text-red-600 min-h-[160px]"
              >
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-sm font-semibold">Ajouter</span>
              </button>
            ) : null}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 bg-white text-sm text-gray-600 max-w-lg mx-auto">
              <span>
                Page {page} / {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Précédent
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </CustomerShell>
  );
}
